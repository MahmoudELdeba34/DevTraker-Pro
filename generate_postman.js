const fs = require('fs');

const collection = {
  info: {
    name: "DevTracker Pro API",
    description: "API Documentation for DevTracker Pro. Use the {{baseUrl}} and {{token}} variables to get started.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  auth: {
    type: "bearer",
    bearer: [
      { key: "token", value: "{{token}}", type: "string" }
    ]
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5000", type: "string" },
    { key: "token", value: "YOUR_JWT_TOKEN", type: "string" }
  ],
  item: []
};

// Helper to create an endpoint
const createItem = (name, method, path, description, body = null, auth = true) => {
  const item = {
    name,
    request: {
      method,
      header: [],
      url: {
        raw: `{{baseUrl}}${path.split('?')[0]}`,
        host: ["{{baseUrl}}"],
        path: path.split('?')[0].split('/').filter(p => p)
      },
      description
    }
  };
  
  if (!auth) {
    item.request.auth = { type: "noauth" };
  }

  if (body) {
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: "json" } }
    };
  }

  return item;
};

// 1. Auth
collection.item.push({
  name: "1. Authentication",
  item: [
    createItem("Register User", "POST", "/api/auth/register", "Register a new user.", { name: "John Doe", email: "john@example.com", password: "secret123", role: "employee" }, false),
    createItem("Login User", "POST", "/api/auth/login", "Login and get a JWT token.", { email: "john@example.com", password: "secret123" }, false),
    createItem("Admin: Create User", "POST", "/api/auth/admin/create-user", "Admin creates a new user and emails temp password.", { name: "Jane Smith", email: "jane@company.com", role: "hr" }),
    createItem("Admin: Reset Password", "POST", "/api/auth/admin/reset-password", "Admin resets a user's password.", { userId: "664abc..." })
  ]
});

// 2. Users
collection.item.push({
  name: "2. Users",
  item: [
    createItem("Get All Users", "GET", "/api/users", "List all users (Admin/Manager)."),
    createItem("Change User Role", "PUT", "/api/users/user_id_here/role", "Admin changes user role.", { role: "manager" }),
    createItem("Heartbeat", "POST", "/api/users/heartbeat", "Update user active timestamp.", { currentPage: "/dashboard" }),
    createItem("Active Sessions", "GET", "/api/users/active-sessions", "Get currently online users.")
  ]
});

// 3. Workspaces
collection.item.push({
  name: "3. Workspaces",
  item: [
    createItem("Get Workspaces", "GET", "/api/workspaces", "List workspaces."),
    createItem("Create Workspace", "POST", "/api/workspaces", "Create a new workspace.", { name: "Engineering Team", description: "Main eng workspace", members: ["userId1"] }),
    createItem("Update Workspace", "PUT", "/api/workspaces/workspace_id_here", "Update workspace (Owner).", { name: "Updated Team" }),
    createItem("Delete Workspace", "DELETE", "/api/workspaces/workspace_id_here", "Delete workspace (Owner)."),
    createItem("Get Members", "GET", "/api/workspaces/workspace_id_here/members", "Get workspace members."),
    createItem("Add Member", "POST", "/api/workspaces/workspace_id_here/members", "Add a member.", { userId: "user_id_here" }),
    createItem("Remove Member", "DELETE", "/api/workspaces/workspace_id_here/members/user_id_here", "Remove a member.")
  ]
});

// 4. Projects
collection.item.push({
  name: "4. Projects",
  item: [
    createItem("Get Projects", "GET", "/api/projects", "List projects (can filter by ?workspaceId=)."),
    createItem("Create Project", "POST", "/api/projects", "Create a new project.", { title: "Website Redesign", deadline: "2024-12-31" }),
    createItem("Update Project", "PUT", "/api/projects/project_id_here", "Update project details.", { title: "Updated Title" }),
    createItem("Delete Project", "DELETE", "/api/projects/project_id_here", "Delete a project.")
  ]
});

// 5. Tasks
collection.item.push({
  name: "5. Tasks & Timer",
  item: [
    createItem("Get Project Tasks", "GET", "/api/tasks/project/project_id_here", "List tasks in a project."),
    createItem("Create Task", "POST", "/api/tasks/project/project_id_here", "Create a new task.", { title: "Design mockups", priority: "high" }),
    createItem("Update Task", "PUT", "/api/tasks/task_id_here", "Update task status/fields.", { status: "completed" }),
    createItem("Delete Task", "DELETE", "/api/tasks/task_id_here", "Delete a task."),
    createItem("My Timesheet", "GET", "/api/tasks/my/timesheet", "Get timesheet tasks."),
    createItem("Start Timer", "POST", "/api/tasks/task_id_here/timer/start", "Start task timer."),
    createItem("Stop Timer", "POST", "/api/tasks/task_id_here/timer/stop", "Stop task timer."),
    createItem("Total Timer", "GET", "/api/tasks/task_id_here/timer/total", "Get total tracked time."),
    createItem("Add Subtask", "POST", "/api/tasks/task_id_here/subtasks", "Add a subtask.", { title: "Write tests" }),
    createItem("Update Subtask", "PUT", "/api/tasks/task_id_here/subtasks/subtask_id_here", "Update a subtask.", { status: "completed" }),
    createItem("Delete Subtask", "DELETE", "/api/tasks/task_id_here/subtasks/subtask_id_here", "Delete a subtask.")
  ]
});

// 6. Attendance
collection.item.push({
  name: "6. Attendance",
  item: [
    createItem("Check-in", "POST", "/api/attendance/check-in", "Daily check-in."),
    createItem("Check-out", "POST", "/api/attendance/check-out", "Daily check-out."),
    createItem("Break Start", "POST", "/api/attendance/break-start", "Start a break."),
    createItem("Break End", "POST", "/api/attendance/break-end", "End a break."),
    createItem("Today's Record", "GET", "/api/attendance/today", "Get attendance for today."),
    createItem("My History", "GET", "/api/attendance/history", "Get attendance history."),
    createItem("Admin: Today", "GET", "/api/attendance/admin/today", "View all today check-ins (Admin/HR)."),
    createItem("Admin: Adjust", "PUT", "/api/attendance/admin/adjust", "Manually adjust record (Admin/HR).", { userId: "user_id", date: "2024-10-30", status: "Present", reason: "Correction" })
  ]
});

// 7. Leaves
collection.item.push({
  name: "7. Leaves",
  item: [
    createItem("Request Leave", "POST", "/api/leaves/request", "Submit a leave request.", { leaveType: "annual", startDate: "2024-11-01", endDate: "2024-11-05", reason: "Vacation" }),
    createItem("My Leaves", "GET", "/api/leaves/my-requests", "List my leave requests."),
    createItem("Leave Balances", "GET", "/api/leaves/balances", "Get current leave balance."),
    createItem("Admin: Pending Leaves", "GET", "/api/leaves/admin/pending", "List pending leaves."),
    createItem("Admin: Approve Leave", "PUT", "/api/leaves/admin/leave_id_here/approve", "Approve a leave."),
    createItem("Admin: Reject Leave", "PUT", "/api/leaves/admin/leave_id_here/reject", "Reject a leave.", { rejectionReason: "Understaffed" })
  ]
});

// 8. Permissions
collection.item.push({
  name: "8. Permissions",
  item: [
    createItem("Request Permission", "POST", "/api/permissions/request", "Submit an hourly permission.", { type: "late_arrival", date: "2024-11-01", fromTime: "09:00", toTime: "10:30", reason: "Doctor" }),
    createItem("My Permissions", "GET", "/api/permissions/my-requests", "List my permissions."),
    createItem("Admin: Pending Permissions", "GET", "/api/permissions/admin/pending", "List pending permissions."),
    createItem("Admin: Approve Permission", "PUT", "/api/permissions/admin/perm_id_here/approve", "Approve a permission."),
    createItem("Admin: Reject Permission", "PUT", "/api/permissions/admin/perm_id_here/reject", "Reject a permission.")
  ]
});

// 9. Overtime
collection.item.push({
  name: "9. Overtime",
  item: [
    createItem("Log Overtime", "POST", "/api/overtime/request", "Log overtime hours.", { date: "2024-11-01", startTime: "17:00", endTime: "20:00", reason: "Deployment" }),
    createItem("My Overtime", "GET", "/api/overtime/my-requests", "List my overtime."),
    createItem("Admin: Pending Overtime", "GET", "/api/overtime/admin/pending", "List pending overtime."),
    createItem("Admin: Approve Overtime", "PUT", "/api/overtime/admin/ot_id_here/approve", "Approve overtime."),
    createItem("Admin: Reject Overtime", "PUT", "/api/overtime/admin/ot_id_here/reject", "Reject overtime.")
  ]
});

// 10. Employees
collection.item.push({
  name: "10. Employees",
  item: [
    createItem("List Employees", "GET", "/api/employees", "List employees (HR/Admin)."),
    createItem("Get Employee Profile", "GET", "/api/employees/user_id_here", "Get specific employee profile."),
    createItem("Update Employee Profile", "PUT", "/api/employees/user_id_here", "Update HR profile.", { roleTitle: "Senior Eng", basicSalary: 6000 })
  ]
});

// 11. Payroll
collection.item.push({
  name: "11. Payroll",
  item: [
    createItem("Run Payroll", "POST", "/api/payroll/run/2024-10", "Generate payroll for a month."),
    createItem("Get Runs", "GET", "/api/payroll/runs", "List all payroll runs."),
    createItem("Get Payslips for Run", "GET", "/api/payroll/runs/run_id_here/payslips", "Get payslips for a specific run."),
    createItem("Update Run Status", "PUT", "/api/payroll/runs/run_id_here/status", "Update status (e.g. approved).", { status: "approved" }),
    createItem("My Payslips", "GET", "/api/payroll/my-payslips", "Get my payslips."),
    createItem("Add Adjustment", "POST", "/api/payroll/adjustments", "Add bonus/deduction.", { userId: "user_id_here", type: "bonus", subType: "commission", amount: 500, payrollMonth: "2024-10", reason: "Sales" }),
    createItem("List Adjustments", "GET", "/api/payroll/adjustments?month=2024-10", "List adjustments for a month.")
  ]
});

// 12. Reports
collection.item.push({
  name: "12. Reports",
  item: [
    createItem("Timesheet Summary", "GET", "/api/reports/summary", "Get timesheet and overtime summary.")
  ]
});

// 13. Notifications
collection.item.push({
  name: "13. Notifications",
  item: [
    createItem("Get Notifications", "GET", "/api/notifications", "List latest notifications."),
    createItem("Unread Count", "GET", "/api/notifications/unread-count", "Get unread count."),
    createItem("Mark as Read", "PUT", "/api/notifications/notif_id_here/read", "Mark one notification as read."),
    createItem("Mark All Read", "PUT", "/api/notifications/read-all", "Mark all as read.")
  ]
});

fs.writeFileSync('g:/DevTracker Pro/DevTracker_Pro_Postman_Collection.json', JSON.stringify(collection, null, 2));
console.log('Postman collection created successfully.');
