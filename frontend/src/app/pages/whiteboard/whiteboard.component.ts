import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkspaceService } from '../../services/workspace.service';
import { WhiteboardService } from '../../services/whiteboard.service';
import { AuthService } from '../../services/auth.service';
import { Workspace, Whiteboard, WhiteboardElement } from '../../models/types';

@Component({
  selector: 'app-whiteboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="h-screen w-screen flex overflow-hidden bg-slate-950 text-slate-300 font-sans">
      
      <!-- Sidebar -->
      <aside class="w-64 border-r border-slate-800 bg-slate-950/80 flex flex-col backdrop-blur-xl shrink-0 z-20">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2 text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <path d="M9 21V9"/>
            </svg>
            <span class="font-bold tracking-tight">Whiteboards</span>
          </div>
          <a routerLink="/dashboard" class="text-slate-500 hover:text-white transition-colors" title="Back to Dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 15l-6-6-6 6"/>
            </svg>
          </a>
        </div>

        <div class="p-4 flex-1 overflow-y-auto">
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Workspace</label>
          <select 
            class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-sm mb-6 outline-none focus:border-purple-500 transition-colors"
            [ngModel]="activeWorkspace()?._id || ''"
            (ngModelChange)="selectWorkspace($event)">
            <option value="">Select Workspace</option>
            @for (ws of workspaces(); track ws._id) {
              <option [value]="ws._id">{{ ws.name }}</option>
            }
          </select>

          @if (activeWorkspace()) {
            <div class="flex items-center justify-between mb-2">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Boards</label>
              <button class="text-purple-400 hover:text-purple-300" (click)="createNewBoard()" title="New Board">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            
            @if (loading()) {
              <div class="animate-pulse flex space-x-2 p-2">
                <div class="w-full h-8 bg-slate-800 rounded"></div>
              </div>
            } @else {
              <div class="space-y-1">
                @for (board of whiteboards(); track board._id) {
                  <button 
                    class="w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 group"
                    [class.bg-purple-600]="activeBoard()?._id === board._id"
                    [class.text-white]="activeBoard()?._id === board._id"
                    [class.hover:bg-slate-800]="activeBoard()?._id !== board._id"
                    (click)="selectBoard(board)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>
                    <span class="truncate flex-1">{{ board.title }}</span>
                    @if (activeBoard()?._id === board._id) {
                      <span class="opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity" (click)="deleteBoard(board._id); $event.stopPropagation()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </span>
                    }
                  </button>
                }
                @if (whiteboards().length === 0) {
                  <p class="text-xs text-slate-500 italic mt-2 text-center">No boards yet.</p>
                }
              </div>
            }
          } @else {
            <p class="text-xs text-slate-500 italic text-center p-4 border border-slate-800 border-dashed rounded-lg">
              Select a workspace to view boards.
            </p>
          }
        </div>
      </aside>

      <!-- Main Canvas Area -->
      <main class="flex-1 relative bg-[#0f172a]" style="background-image: radial-gradient(#1e293b 1px, transparent 1px); background-size: 24px 24px;">
        @if (!activeBoard()) {
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-slate-800 mb-4">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <path d="M9 21V9"/>
            </svg>
            <h2 class="text-xl font-medium text-slate-400 mb-2">Whiteboard Canvas</h2>
            <p class="text-slate-600 text-sm max-w-md">Select or create a board to start organizing your thoughts, architecture diagrams, and sticky notes.</p>
          </div>
        } @else {
          
          <!-- Toolbar -->
          <div class="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-full shadow-2xl p-1.5 flex items-center gap-1">
            <button class="p-2 rounded-full hover:bg-slate-700 transition-colors" [class.bg-purple-600]="currentTool() === 'select'" [class.text-white]="currentTool() === 'select'" (click)="setTool('select')" title="Select Tool">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
              </svg>
            </button>
            <button class="p-2 rounded-full hover:bg-slate-700 transition-colors" [class.bg-purple-600]="currentTool() === 'sticky'" [class.text-white]="currentTool() === 'sticky'" (click)="setTool('sticky')" title="Add Sticky Note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3h18v18H3z"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </button>
            <div class="w-px h-6 bg-slate-700 mx-1"></div>
            <button class="p-2 rounded-full hover:bg-slate-700 transition-colors text-slate-300" (click)="saveBoard()" title="Save Board">
              @if (saving()) {
                <div class="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
              }
            </button>
          </div>

          <!-- Canvas container -->
          <div 
            class="absolute inset-0 z-10 overflow-hidden cursor-crosshair"
            (mousedown)="onCanvasMouseDown($event)"
            (mousemove)="onCanvasMouseMove($event)"
            (mouseup)="onCanvasMouseUp()"
            (mouseleave)="onCanvasMouseUp()">
            
            <div 
              class="relative w-full h-full transform-origin-0"
              [style.transform]="'translate(' + panX() + 'px, ' + panY() + 'px) scale(' + zoom() + ')'">
              
              <!-- Elements -->
              @for (el of elements(); track el.id) {
                @if (el.type === 'sticky') {
                  <div 
                    class="absolute cursor-move shadow-lg rounded-md p-3 transition-shadow hover:shadow-xl hover:ring-2 ring-purple-500 ring-offset-2 ring-offset-slate-900"
                    [style.left.px]="el.x"
                    [style.top.px]="el.y"
                    [style.width.px]="el.width || 150"
                    [style.height.px]="el.height || 150"
                    [style.background]="el.color || '#fef3c7'"
                    (mousedown)="onElementMouseDown($event, el)">
                    <textarea 
                      class="w-full h-full bg-transparent resize-none border-none outline-none text-slate-900 placeholder:text-slate-800/50"
                      [(ngModel)]="el.text"
                      (mousedown)="$event.stopPropagation()"
                      placeholder="Type note..."></textarea>
                      <button 
                        class="absolute -top-2 -right-2 bg-slate-900 text-slate-400 hover:text-red-400 rounded-full p-1 opacity-0 group-hover:opacity-100 shadow-md border border-slate-700"
                        (click)="deleteElement(el.id); $event.stopPropagation()">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                  </div>
                }
              }
            </div>
          </div>
          
          <!-- Zoom Controls -->
          <div class="absolute bottom-6 left-6 z-30 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-lg shadow-lg flex items-center p-1">
            <button class="p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors" (click)="zoomOut()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <span class="text-xs font-mono px-2 text-slate-300">{{ Math.round(zoom() * 100) }}%</span>
            <button class="p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors" (click)="zoomIn()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .transform-origin-0 { transform-origin: 0 0; }
  `]
})
export class WhiteboardComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private whiteboardService = inject(WhiteboardService);
  private authService = inject(AuthService);

  workspaces = signal<Workspace[]>([]);
  activeWorkspace = signal<Workspace | null>(null);
  
  whiteboards = signal<Whiteboard[]>([]);
  activeBoard = signal<Whiteboard | null>(null);
  
  elements = signal<WhiteboardElement[]>([]);
  
  loading = signal(false);
  saving = signal(false);

  // Canvas State
  currentTool = signal<'select' | 'sticky'>('select');
  zoom = signal(1);
  panX = signal(0);
  panY = signal(0);
  
  isDragging = false;
  isPanning = false;
  dragStartX = 0;
  dragStartY = 0;
  activeElementId: string | null = null;
  Math = Math;

  ngOnInit(): void {
    this.workspaceService.getWorkspaces().subscribe(res => {
      this.workspaces.set(res);
      if (res.length > 0) {
        this.selectWorkspace(res[0]._id);
      }
    });
  }

  selectWorkspace(id: string): void {
    const ws = this.workspaces().find(w => w._id === id);
    this.activeWorkspace.set(ws || null);
    this.activeBoard.set(null);
    this.elements.set([]);
    if (ws) {
      this.loadBoards(ws._id);
    } else {
      this.whiteboards.set([]);
    }
  }

  loadBoards(workspaceId: string): void {
    this.loading.set(true);
    this.whiteboardService.getWhiteboards(workspaceId).subscribe({
      next: (boards) => {
        this.whiteboards.set(boards);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  selectBoard(board: Whiteboard): void {
    this.activeBoard.set(board);
    this.elements.set([...board.elements]);
    this.panX.set(0);
    this.panY.set(0);
    this.zoom.set(1);
  }

  createNewBoard(): void {
    const title = prompt('Enter board name:');
    if (!title || !this.activeWorkspace()) return;
    
    this.whiteboardService.createWhiteboard({
      workspaceId: this.activeWorkspace()!._id,
      title
    }).subscribe(board => {
      this.whiteboards.update(b => [board, ...b]);
      this.selectBoard(board);
    });
  }

  deleteBoard(id: string): void {
    if (!confirm('Are you sure you want to delete this board?')) return;
    this.whiteboardService.deleteWhiteboard(id).subscribe(() => {
      this.whiteboards.update(b => b.filter(x => x._id !== id));
      if (this.activeBoard()?._id === id) {
        this.activeBoard.set(null);
      }
    });
  }

  saveBoard(): void {
    const board = this.activeBoard();
    if (!board) return;
    
    this.saving.set(true);
    this.whiteboardService.updateWhiteboard(board._id, {
      elements: this.elements(),
      connections: []
    }).subscribe({
      next: () => {
        setTimeout(() => this.saving.set(false), 500);
      },
      error: () => this.saving.set(false)
    });
  }

  setTool(tool: 'select' | 'sticky') {
    this.currentTool.set(tool);
  }

  // --- Interaction Logic ---
  
  onCanvasMouseDown(e: MouseEvent): void {
    if (!this.activeBoard()) return;
    
    if (this.currentTool() === 'sticky') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left - this.panX()) / this.zoom();
      const y = (e.clientY - rect.top - this.panY()) / this.zoom();
      
      const colors = ['#fef3c7', '#fce7f3', '#e0e7ff', '#dcfce7'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const newSticky: WhiteboardElement = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'sticky',
        x: x - 75,
        y: y - 75,
        width: 150,
        height: 150,
        text: '',
        color
      };
      
      this.elements.update(el => [...el, newSticky]);
      this.currentTool.set('select'); // revert to select
    } else if (e.button === 0 || e.button === 1) { // Left or middle click for panning if not clicking an element
      this.isPanning = true;
      this.dragStartX = e.clientX - this.panX();
      this.dragStartY = e.clientY - this.panY();
    }
  }

  onElementMouseDown(e: MouseEvent, el: WhiteboardElement): void {
    if (this.currentTool() !== 'select') return;
    e.stopPropagation(); // prevent canvas panning
    
    this.isDragging = true;
    this.activeElementId = el.id;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  }

  @HostListener('window:mousemove', ['$event'])
  onGlobalMouseMove(e: MouseEvent): void {
    this.onCanvasMouseMove(e);
  }

  @HostListener('window:mouseup', ['$event'])
  onGlobalMouseUp(e: MouseEvent): void {
    this.onCanvasMouseUp();
  }

  onCanvasMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      this.panX.set(e.clientX - this.dragStartX);
      this.panY.set(e.clientY - this.dragStartY);
    } else if (this.isDragging && this.activeElementId) {
      const dx = (e.clientX - this.dragStartX) / this.zoom();
      const dy = (e.clientY - this.dragStartY) / this.zoom();
      
      this.elements.update(els => els.map(el => {
        if (el.id === this.activeElementId) {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        return el;
      }));
      
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
    }
  }

  onCanvasMouseUp(): void {
    this.isDragging = false;
    this.isPanning = false;
    this.activeElementId = null;
  }
  
  deleteElement(id: string): void {
    this.elements.update(els => els.filter(el => el.id !== id));
  }

  zoomIn(): void {
    this.zoom.update(z => Math.min(z + 0.1, 2));
  }

  zoomOut(): void {
    this.zoom.update(z => Math.max(z - 0.1, 0.2));
  }
}
