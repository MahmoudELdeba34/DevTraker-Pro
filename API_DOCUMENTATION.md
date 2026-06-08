# DevTracker Pro — API Documentation

> **Base URL:** `http://localhost:5000/api`  
> **Authentication:** All protected routes require a Bearer token in the `Authorization` header.  
> `Authorization: Bearer <token>`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Workspaces](#3-workspaces)
4. [Projects](#4-projects)
5. [Tasks & Timer](#5-tasks--timer)
6. [Attendance](#6-attendance)
7. [Leaves](#7-leaves)
8. [Permissions](#8-permissions)
9. [Overtime](#9-overtime)
10. [Employees](#10-employees)
11. [Payroll](#11-payroll)
12. [Reports](#12-reports)
13. [Notifications](#13-notifications)

---

## Role Reference

| Role        | Description |
|-------------|-------------|
| `admin`     | Full system access |
| `manager`   | Can view team data, approve requests |
| `hr`        | Human resources, attendance, leaves, payroll |
| `accountant`| Payroll access only |
| `employee`  | Standard user — own data only |

---

## 1. Authentication

### `POST /api/auth/register`
Register a new user account.

> ⚠️ The **first** registered user automatically gets the `admin` role.

**Auth Required:** ❌ No

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "role": "employee"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Full name |
| `email` | string | ✅ | Unique email address |
| `password` | string | ✅ | Minimum 6 characters |
| `role` | string | ❌ | `employee` \| `manager` \| `admin` \| `hr` \| `accountant` (defaults to `employee`) |

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "_id": "664abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee"
    }
  }
}
```

---

### `POST /api/auth/login`
Authenticate and get a JWT token.

**Auth Required:** ❌ No

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "_id": "664abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee"
    }
  }
}
```

**Errors:**
- `401` — Invalid email or password

---

### `POST /api/auth/admin/create-user`
Admin creates a new user. A temporary password is auto-generated and emailed to the user.

**Auth Required:** ✅ `admin` only

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "role": "hr"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "Jane Smith", "email": "jane@company.com", "role": "hr" },
    "message": "User created and email sent successfully."
  }
}
```

---

### `POST /api/auth/admin/reset-password`
Admin resets a user's password. A new temporary password is emailed to the user.

**Auth Required:** ✅ `admin` only

**Request Body:**
```json
{
  "userId": "664abc..."
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Password reset email sent to jane@company.com" }
}
```

---

## 2. Users

### `GET /api/users`
List all users in the system.

**Auth Required:** ✅ `admin` or `manager`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee",
      "lastActiveAt": "2024-10-30T12:00:00Z",
      "currentPage": "/dashboard",
      "sessionStart": "2024-10-30T09:00:00Z"
    }
  ]
}
```

---

### `PUT /api/users/:id/role`
Change a user's system role.

**Auth Required:** ✅ `admin` only

**Request Body:**
```json
{
  "role": "manager"
}
```
Valid values: `employee` | `manager` | `admin` | `hr` | `accountant`

**Response `200`:**
```json
{
  "success": true,
  "data": { "_id": "664abc...", "role": "manager" }
}
```

---

### `POST /api/users/heartbeat`
Update user's last active timestamp and current page. Should be called every ~15 seconds by the frontend.

**Auth Required:** ✅ All authenticated users

**Request Body:**
```json
{
  "currentPage": "/dashboard"
}
```

**Response `200`:**
```json
{ "success": true }
```

---

### `GET /api/users/active-sessions`
Get list of users who were active in the last 45 seconds (currently online).

**Auth Required:** ✅ `admin` only

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee",
      "lastActiveAt": "2024-10-30T12:00:00Z",
      "currentPage": "/dashboard",
      "sessionStart": "2024-10-30T09:00:00Z"
    }
  ]
}
```

---

## 3. Workspaces

### `GET /api/workspaces`
Get all workspaces (admin sees all; others see own + member workspaces).

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
[
  {
    "_id": "664ws...",
    "name": "Engineering Team",
    "description": "Main engineering workspace",
    "ownerId": { "_id": "...", "name": "John", "email": "john@example.com" },
    "members": [{ "_id": "...", "name": "Jane", "email": "jane@example.com" }]
  }
]
```

---

### `POST /api/workspaces`
Create a new workspace.

**Auth Required:** ✅ All authenticated users

**Request Body:**
```json
{
  "name": "Engineering Team",
  "description": "Optional description",
  "members": ["userId1", "userId2"]
}
```

**Response `201`:** The created workspace object.

---

### `PUT /api/workspaces/:id`
Update workspace details. Only the owner can update.

**Auth Required:** ✅ Workspace owner

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "New description",
  "members": ["userId1"]
}
```

**Response `200`:** Updated workspace object.

---

### `DELETE /api/workspaces/:id`
Delete a workspace. Only the owner can delete.

**Auth Required:** ✅ Workspace owner

**Response `200`:**
```json
{ "message": "Workspace deleted successfully" }
```

---

### `GET /api/workspaces/:id/members`
Get all members of a workspace (includes owner with `isOwner: true` flag).

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
[
  { "_id": "...", "name": "John", "email": "john@example.com", "role": "admin", "isOwner": true },
  { "_id": "...", "name": "Jane", "email": "jane@example.com", "role": "employee", "isOwner": false }
]
```

---

### `POST /api/workspaces/:id/members`
Add a member to a workspace.

**Auth Required:** ✅ All authenticated users

**Request Body:**
```json
{
  "userId": "664abc..."
}
```

**Response `201`:** Updated workspace object with populated members.

**Errors:**
- `409` — User is already a member

---

### `DELETE /api/workspaces/:id/members/:userId`
Remove a member from a workspace. Cannot remove the owner.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{ "message": "Member removed successfully" }
```

---

## 4. Projects

### `GET /api/projects`
Get projects accessible to the current user.

**Auth Required:** ✅ All authenticated users

**Query Parameters:**

| Param | Description |
|-------|-------------|
| `workspaceId` | Filter by workspace ID. Pass `null` to get projects without a workspace. |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664proj...",
      "title": "Website Redesign",
      "description": "Full redesign of company website",
      "userId": "664abc...",
      "workspaceId": "664ws...",
      "members": ["userId1", "userId2"],
      "deadline": "2024-12-31T00:00:00Z",
      "createdAt": "2024-10-01T00:00:00Z"
    }
  ]
}
```

---

### `POST /api/projects`
Create a new project.

**Auth Required:** ✅ All authenticated users

**Request Body:**
```json
{
  "title": "Website Redesign",
  "description": "Full redesign of company website",
  "deadline": "2024-12-31",
  "members": ["userId1", "userId2"],
  "workspaceId": "664ws..."
}
```

| Field | Type | Required |
|-------|------|----------|
| `title` | string | ✅ |
| `description` | string | ❌ |
| `deadline` | ISO date string | ❌ |
| `members` | string[] (user IDs) | ❌ |
| `workspaceId` | string | ❌ |

**Response `201`:** Created project object.

---

### `PUT /api/projects/:id`
Update a project. Only the project owner or admin can update.

**Auth Required:** ✅ Project owner or `admin`

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "description": "New description",
  "deadline": "2025-01-15",
  "members": ["userId1"],
  "workspaceId": "664ws..."
}
```

**Response `200`:** Updated project object.

---

### `DELETE /api/projects/:id`
Delete a project and all its tasks.

**Auth Required:** ✅ Project owner or `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Project deleted" }
}
```

---

## 5. Tasks & Timer

### `GET /api/tasks/project/:projectId`
Get all tasks for a project.

**Auth Required:** ✅ Project member or `admin`

**Query Parameters:**

| Param | Description |
|-------|-------------|
| `status` | Filter by status: `not_started` \| `in_progress` \| `in_review` \| `completed` |
| `priority` | Filter by priority: `low` \| `medium` \| `high` |
| `deadline` | `today` \| `week` \| `overdue` |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664task...",
      "projectId": "664proj...",
      "title": "Design mockups",
      "status": "in_progress",
      "priority": "high",
      "deadline": "2024-11-15T00:00:00Z",
      "assignedTo": { "_id": "...", "name": "Jane", "email": "jane@example.com", "role": "employee" },
      "subtasks": [],
      "timeLogs": [],
      "activeTimerStart": null,
      "activeTimerUserId": null,
      "createdAt": "2024-10-01T00:00:00Z"
    }
  ]
}
```

---

### `POST /api/tasks/project/:projectId`
Create a new task in a project.

**Auth Required:** ✅ Project member or `admin`

**Request Body:**
```json
{
  "title": "Design mockups",
  "priority": "high",
  "deadline": "2024-11-15",
  "assignedTo": "userId1"
}
```

| Field | Type | Required |
|-------|------|----------|
| `title` | string | ✅ |
| `priority` | `low` \| `medium` \| `high` | ❌ (default: `medium`) |
| `deadline` | ISO date string | ❌ |
| `assignedTo` | string (user ID) | ❌ |

**Response `201`:** Created task object with populated `assignedTo`.

---

### `PUT /api/tasks/:id`
Update a task's fields.

**Auth Required:** ✅ Project member or `admin`

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "status": "completed",
  "priority": "low",
  "deadline": "2024-12-01",
  "assignedTo": "userId2"
}
```

Valid `status` values: `not_started` | `in_progress` | `in_review` | `completed`

**Response `200`:** Updated task object.

---

### `DELETE /api/tasks/:id`
Delete a task.

**Auth Required:** ✅ Project member or `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Task deleted" }
}
```

---

### `GET /api/tasks/my/timesheet`
Get all tasks where the current user has time logs or an active timer.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664task...",
      "title": "Design mockups",
      "projectId": { "_id": "664proj...", "title": "Website Redesign" },
      "timeLogs": [
        {
          "userId": "664abc...",
          "start": "2024-10-30T09:00:00Z",
          "end": "2024-10-30T11:00:00Z",
          "duration": 7200000
        }
      ],
      "activeTimerStart": null,
      "activeTimerUserId": null
    }
  ]
}
```

---

### `POST /api/tasks/:id/timer/start`
Start the time tracker for a task.

**Auth Required:** ✅ Project member or `admin`

> ⚠️ A task can only have **one** active timer at a time.

**Response `200`:** Updated task object with `activeTimerStart` set.

**Errors:**
- `400` — Timer already running

---

### `POST /api/tasks/:id/timer/stop`
Stop the active timer and save the time log.

**Auth Required:** ✅ Project member or `admin`

**Response `200`:** Updated task object. The time log is appended to `timeLogs`.

**Errors:**
- `400` — No timer running

---

### `GET /api/tasks/:id/timer/total`
Get the total tracked time (in milliseconds) for a task.

**Auth Required:** ✅ Project member or `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": { "totalMs": 7200000 }
}
```

---

### `POST /api/tasks/:id/subtasks`
Add a subtask to a task.

**Auth Required:** ✅ Project member or `admin`

**Request Body:**
```json
{
  "title": "Write unit tests",
  "priority": "medium",
  "assignedTo": "userId1",
  "deadline": "2024-11-20"
}
```

**Response `201`:** Updated parent task object with the new subtask.

---

### `PUT /api/tasks/:id/subtasks/:subtaskId`
Update a subtask.

**Auth Required:** ✅ Project member or `admin`

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "status": "completed",
  "priority": "high",
  "assignedTo": "userId2",
  "deadline": "2024-11-25"
}
```

**Response `200`:** Updated parent task object.

---

### `DELETE /api/tasks/:id/subtasks/:subtaskId`
Delete a subtask.

**Auth Required:** ✅ Project member or `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "Subtask deleted" }
}
```

---

## 6. Attendance

### `POST /api/attendance/check-in`
Check in for today. Automatically calculates `Late` status if check-in is after 09:15 AM.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "_id": "664att...",
    "userId": "664abc...",
    "date": "2024-10-30",
    "checkIn": "2024-10-30T09:20:00Z",
    "status": "Late",
    "lateMinutes": 20,
    "breaks": []
  }
}
```

**Errors:**
- `400` — Already checked in for today

---

### `POST /api/attendance/check-out`
Check out for today. Calculates worked minutes and early-leave status.

**Auth Required:** ✅ All authenticated users

**Response `200`:** Updated attendance record with `checkOut`, `workedMinutes`, `earlyOutMinutes`.

**Errors:**
- `400` — Must check-in first / Already checked out

---

### `POST /api/attendance/break-start`
Start a break during an active session.

**Auth Required:** ✅ All authenticated users

**Response `200`:** Updated attendance record with new break entry.

**Errors:**
- `400` — No active session / Already on break

---

### `POST /api/attendance/break-end`
End the current active break.

**Auth Required:** ✅ All authenticated users

**Response `200`:** Updated attendance record with break end time.

**Errors:**
- `400` — No active break to end

---

### `GET /api/attendance/today`
Get the current user's attendance record for today.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": { ... }  // Attendance object or null
}
```

---

### `GET /api/attendance/history`
Get the last 100 attendance records for the current user.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": [/* array of attendance records */]
}
```

---

### `GET /api/attendance/admin/today`
Get all attendance records for today (admin view).

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "userId": { "_id": "...", "name": "John", "email": "john@example.com", "role": "employee" },
      "date": "2024-10-30",
      "checkIn": "2024-10-30T09:00:00Z",
      "status": "Present"
    }
  ]
}
```

---

### `PUT /api/attendance/admin/adjust`
Manually override an attendance record for any user.

**Auth Required:** ✅ `admin` | `hr`

**Request Body:**
```json
{
  "userId": "664abc...",
  "date": "2024-10-30",
  "checkIn": "2024-10-30T09:00:00Z",
  "checkOut": "2024-10-30T17:00:00Z",
  "status": "Present",
  "reason": "Manual correction by HR"
}
```

| Field | Type | Required |
|-------|------|----------|
| `userId` | string | ✅ |
| `date` | `YYYY-MM-DD` | ✅ |
| `status` | string | ✅ |
| `reason` | string | ✅ |
| `checkIn` | ISO datetime | ❌ |
| `checkOut` | ISO datetime | ❌ |

**Response `200`:** Updated attendance record.

---

## 7. Leaves

### `POST /api/leaves/request`
Submit a leave request.

**Auth Required:** ✅ All authenticated users

**Request Body:**
```json
{
  "leaveType": "annual",
  "startDate": "2024-11-01",
  "endDate": "2024-11-05",
  "reason": "Family vacation"
}
```

| Field | Type | Required | Options |
|-------|------|----------|---------|
| `leaveType` | string | ✅ | `annual` \| `sick` \| `unpaid` \| `emergency` |
| `startDate` | ISO date | ✅ | |
| `endDate` | ISO date | ✅ | |
| `reason` | string | ✅ | |

> ⚠️ Annual leave requests are validated against the employee's `annualLeaveBalance`.

**Response `201`:** Created leave request object.

---

### `GET /api/leaves/my-requests`
Get all leave requests submitted by the current user.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664lv...",
      "userId": "664abc...",
      "leaveType": "annual",
      "startDate": "2024-11-01T00:00:00Z",
      "endDate": "2024-11-05T00:00:00Z",
      "durationDays": 5,
      "reason": "Family vacation",
      "status": "pending",
      "createdAt": "2024-10-30T00:00:00Z"
    }
  ]
}
```

---

### `GET /api/leaves/balances`
Get the current user's leave balance.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": { "annualLeaveBalance": 12 }
}
```

---

### `GET /api/leaves/admin/pending`
Get all pending leave requests (admin view).

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Array of leave requests with populated `userId` field.

---

### `PUT /api/leaves/admin/:id/approve`
Approve a pending leave request. Auto-deducts balance for annual leaves and creates attendance records.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Updated leave object with `status: "approved"`.

---

### `PUT /api/leaves/admin/:id/reject`
Reject a pending leave request.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Request Body:**
```json
{
  "rejectionReason": "Team is understaffed during that period"
}
```

**Response `200`:** Updated leave object with `status: "rejected"`.

---

## 8. Permissions

Permission requests allow employees to formally request late arrivals, early departures, etc.

### `POST /api/permissions/request`
Submit a permission request.

**Auth Required:** ✅ All authenticated users

**Request Body:**
```json
{
  "type": "late_arrival",
  "date": "2024-11-01",
  "fromTime": "09:00",
  "toTime": "10:30",
  "reason": "Doctor appointment"
}
```

| Field | Type | Required | Options |
|-------|------|----------|---------|
| `type` | string | ✅ | `late_arrival` \| `early_leave` \| `hourly` \| `remote` \| `correction` |
| `date` | `YYYY-MM-DD` | ✅ | |
| `fromTime` | `HH:MM` | ✅ | |
| `toTime` | `HH:MM` | ✅ | |
| `reason` | string | ✅ | |

**Response `201`:** Created permission object with calculated `durationMinutes`.

---

### `GET /api/permissions/my-requests`
Get all permission requests submitted by the current user.

**Auth Required:** ✅ All authenticated users

**Response `200`:** Array of permission objects.

---

### `GET /api/permissions/admin/pending`
Get all pending permission requests.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Array of permission objects with populated `userId`.

---

### `PUT /api/permissions/admin/:id/approve`
Approve a permission request.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Updated permission with `status: "approved"`. User is notified.

---

### `PUT /api/permissions/admin/:id/reject`
Reject a permission request.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Updated permission with `status: "rejected"`. User is notified.

---

## 9. Overtime

### `POST /api/overtime/request`
Submit an overtime work request.

**Auth Required:** ✅ All authenticated users

**Request Body:**
```json
{
  "date": "2024-11-01",
  "startTime": "17:00",
  "endTime": "20:00",
  "reason": "Critical deployment",
  "multiplier": 1.5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | `YYYY-MM-DD` | ✅ | |
| `startTime` | `HH:MM` | ✅ | |
| `endTime` | `HH:MM` | ✅ | |
| `reason` | string | ✅ | |
| `multiplier` | number | ❌ | Pay multiplier (default: `1.5`) |

**Response `201`:** Created overtime object with calculated `durationHours`.

---

### `GET /api/overtime/my-requests`
Get all overtime requests submitted by the current user.

**Auth Required:** ✅ All authenticated users

**Response `200`:** Array of overtime objects.

---

### `GET /api/overtime/admin/pending`
Get all pending overtime requests.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Array of overtime objects with populated `userId`.

---

### `PUT /api/overtime/admin/:id/approve`
Approve an overtime request. User is notified.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Updated overtime object with `status: "approved"`.

---

### `PUT /api/overtime/admin/:id/reject`
Reject an overtime request. User is notified.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:** Updated overtime object with `status: "rejected"`.

---

## 10. Employees

### `GET /api/employees`
Get all employees with their HR profiles.

**Auth Required:** ✅ `admin` | `hr` | `manager`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee",
      "profile": {
        "roleTitle": "Software Engineer",
        "department": "Engineering",
        "basicSalary": 5000,
        "annualLeaveBalance": 15,
        "status": "active"
      }
    }
  ]
}
```

---

### `GET /api/employees/:userId`
Get a specific employee with their full HR profile.

**Auth Required:** ✅ Own profile (any role) | `admin` | `hr` | `manager`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "_id": "664abc...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee",
    "profile": {
      "phone": "+201000000000",
      "roleTitle": "Software Engineer",
      "department": "Engineering",
      "managerId": { "_id": "...", "name": "Manager Name", "email": "mgr@example.com" },
      "hireDate": "2023-01-15T00:00:00Z",
      "contractType": "full-time",
      "status": "active",
      "basicSalary": 5000,
      "salaryType": "monthly",
      "workingDays": 26,
      "workingHours": 8,
      "annualLeaveBalance": 15
    }
  }
}
```

---

### `PUT /api/employees/:userId`
Create or update an employee's HR profile.

**Auth Required:** ✅ `admin` | `hr`

**Request Body:** (all fields optional)
```json
{
  "phone": "+201000000000",
  "roleTitle": "Senior Engineer",
  "department": "Engineering",
  "managerId": "664mgr...",
  "hireDate": "2023-01-15",
  "contractType": "full-time",
  "status": "active",
  "basicSalary": 6000,
  "salaryType": "monthly",
  "workingDays": 26,
  "workingHours": 8,
  "annualLeaveBalance": 21,
  "role": "manager"
}
```

> 💡 Passing `role` requires `admin` — it also updates the user's system role.

**Response `200`:** Updated profile object.

---

## 11. Payroll

### `POST /api/payroll/run/:month`
Run the monthly payroll calculation for all active employees.

**Auth Required:** ✅ `admin` | `hr` | `accountant`

**URL Params:**
- `:month` — Format: `YYYY-MM` (e.g., `2024-10`)

> ⚠️ Cannot recalculate a **locked** or **paid** payroll month.

**Payroll Calculation Includes:**
- ✅ Basic salary
- ✅ Absence deductions (daily rate × absent days)
- ✅ Lateness deductions (after approved permissions subtracted)
- ✅ Approved overtime pay (hours × multiplier × hourly rate)
- ✅ Manual bonuses and deductions
- ✅ Unpaid leave deductions

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "run": {
      "_id": "664run...",
      "month": "2024-10",
      "status": "calculated",
      "summary": {
        "totalBasicSalary": 50000,
        "totalBonuses": 2500,
        "totalDeductions": 1000,
        "totalNetSalary": 51500,
        "employeesCount": 10
      }
    },
    "payslips": [/* array of draft payslips */]
  }
}
```

---

### `GET /api/payroll/runs`
Get all payroll run history.

**Auth Required:** ✅ `admin` | `hr` | `accountant`

**Response `200`:** Array of payroll run objects sorted by month (newest first).

---

### `GET /api/payroll/runs/:id/payslips`
Get all payslips within a specific payroll run.

**Auth Required:** ✅ `admin` | `hr` | `accountant`

**Response `200`:** Array of payslips with populated `userId`, sorted by `netSalary` descending.

---

### `PUT /api/payroll/runs/:id/status`
Update the status of a payroll run.

**Auth Required:** ✅ `admin` | `hr` | `accountant`

**Request Body:**
```json
{
  "status": "approved"
}
```

| Status | Description |
|--------|-------------|
| `draft` | Initial state |
| `calculated` | After running |
| `under_review` | Being reviewed |
| `approved` | Approved (payslips also set to approved) |
| `paid` | Salary disbursed (payslips also set to paid) |
| `locked` | Cannot be recalculated |

**Response `200`:** Updated payroll run object.

---

### `GET /api/payroll/my-payslips`
Get the current user's own payslip history.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664slip...",
      "payrollRunId": { "_id": "664run...", "month": "2024-10", "status": "paid" },
      "basicSalary": 5000,
      "workedDays": 22,
      "absentDays": 1,
      "paidLeaves": 2,
      "unpaidLeaves": 0,
      "lateMinutes": 0,
      "overtimeHours": 3,
      "overtimeAmount": 112.5,
      "bonuses": 112.5,
      "deductions": 192.31,
      "netSalary": 4920.19,
      "status": "paid"
    }
  ]
}
```

---

### `POST /api/payroll/adjustments`
Add a manual salary bonus or deduction for an employee.

**Auth Required:** ✅ `admin` | `hr` | `accountant`

**Request Body:**
```json
{
  "userId": "664abc...",
  "type": "bonus",
  "subType": "commission",
  "amount": 500,
  "payrollMonth": "2024-10",
  "reason": "Q4 sales commission"
}
```

| Field | Type | Required | Options |
|-------|------|----------|---------|
| `userId` | string | ✅ | |
| `type` | string | ✅ | `bonus` \| `deduction` |
| `subType` | string | ✅ | `bonus` \| `allowance` \| `commission` \| `penalty` \| `manual` |
| `amount` | number | ✅ | |
| `payrollMonth` | `YYYY-MM` | ✅ | |
| `reason` | string | ✅ | |

**Response `201`:** Created salary adjustment object.

---

### `GET /api/payroll/adjustments`
Get all salary adjustments for a specific month.

**Auth Required:** ✅ `admin` | `hr` | `accountant`

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `month` | ✅ | Format: `YYYY-MM` |

**Response `200`:** Array of salary adjustments with populated `userId`.

---

## 12. Reports

### `GET /api/reports/summary`
Get a detailed timesheet report with daily breakdown and overtime calculation.

**Auth Required:** ✅ All authenticated users (others' reports require `admin` or `manager`)

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `userId` | ❌ | Target user ID (admin/manager only). Defaults to self. |
| `startDate` | ❌ | Filter start date (`YYYY-MM-DD`) |
| `endDate` | ❌ | Filter end date (`YYYY-MM-DD`) |

**Overtime Threshold:** 7 hours/day. Any time above that is counted as overtime.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "664abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee"
    },
    "summary": {
      "totalHours": 45.5,
      "totalRegularHours": 35.0,
      "totalOvertimeHours": 10.5,
      "daysWorkedCount": 5
    },
    "days": [
      {
        "date": "2024-10-28",
        "totalHours": 9.5,
        "regularHours": 7.0,
        "overtimeHours": 2.5,
        "tasks": [
          {
            "taskId": "664task...",
            "title": "Design mockups",
            "projectTitle": "Website Redesign",
            "hours": 9.5
          }
        ]
      }
    ]
  }
}
```

---

## 13. Notifications

### `GET /api/notifications`
Get the current user's latest 50 notifications.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "664notif...",
      "userId": "664abc...",
      "type": "task_assigned",
      "title": "New Task Assigned",
      "message": "John assigned you to task \"Design mockups\" in project \"Website Redesign\".",
      "link": "/projects/664proj...",
      "read": false,
      "createdAt": "2024-10-30T12:00:00Z"
    }
  ]
}
```

---

### `GET /api/notifications/unread-count`
Get the count of unread notifications for the current user.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": { "count": 3 }
}
```

---

### `PUT /api/notifications/:id/read`
Mark a single notification as read.

**Auth Required:** ✅ All authenticated users (own notifications only)

**Response `200`:** Updated notification object with `read: true`.

**Errors:**
- `404` — Notification not found or doesn't belong to user

---

### `PUT /api/notifications/read-all`
Mark all of the current user's unread notifications as read.

**Auth Required:** ✅ All authenticated users

**Response `200`:**
```json
{
  "success": true,
  "data": { "message": "All notifications marked as read" }
}
```

---

## Standard Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

| Status Code | Meaning |
|-------------|---------|
| `400` | Bad Request — Missing or invalid input |
| `401` | Unauthorized — Invalid or missing token |
| `403` | Forbidden — Insufficient role permissions |
| `404` | Not Found — Resource doesn't exist |
| `409` | Conflict — Resource already exists |
| `500` | Internal Server Error |

---

## Notification Types Reference

| Type | Trigger |
|------|---------|
| `task_assigned` | A task or subtask is assigned to you |
| `project_invited` | You were added to a project |
| `leave_approved` | Your leave request was approved |
| `leave_rejected` | Your leave request was rejected |
| `permission_approved` | Your permission request was approved |
| `permission_rejected` | Your permission request was rejected |
| `overtime_approved` | Your overtime request was approved |
| `overtime_rejected` | Your overtime request was rejected |
| `account_created` | Your account was created by an admin |
| `password_reset` | Your password was reset by an admin |
