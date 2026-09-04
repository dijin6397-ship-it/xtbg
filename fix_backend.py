import os

BASE = r"F:\自开发程序\协同平台"

# --- 1. db.js: add migration to set admin department to '公司' ---
db_path = os.path.join(BASE, "server", "db.js")
with open(db_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add migration line in importOrgData function, before the existing admin module assignment
old_admin_marker = "const adminUser = db.exec(\"SELECT id FROM users WHERE username = 'admin'\")"
migration_line = "  db.run(\"UPDATE users SET department = '公司' WHERE username = 'admin'\")\n\n"
if "UPDATE users SET department" not in content and old_admin_marker in content:
    content = content.replace(old_admin_marker, migration_line + old_admin_marker)
    with open(db_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("db.js: added admin department migration")
else:
    print("db.js: migration already exists or marker not found")

# --- 2. users.js: add GET /api/users/full with modules ---
users_path = os.path.join(BASE, "server", "routes", "users.js")
with open(users_path, "r", encoding="utf-8") as f:
    content = f.read()

new_endpoint = '''
// GET /api/users/full - List all users with their module assignments (admin only)
router.get('/full', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDB()
  const users = getAllUsers(db, req.query)
  // Attach modules to each user
  const modRows = db.exec('SELECT id, module_key, name FROM modules ORDER BY sort_order')
  const allMods = modRows.length > 0 ? modRows[0].values.map(r => ({ id: r[0], moduleKey: r[1], name: r[2] })) : []
  
  for (const user of users) {
    const umRows = db.exec('SELECT module_id FROM user_modules WHERE user_id = ' + user.id)
    const assignedIds = umRows.length > 0 ? umRows[0].values.map(r => r[0]) : []
    user.modules = allMods.map(m => ({ ...m, assigned: assignedIds.includes(m.id) }))
  }
  res.json({ users, modules: allMods })
})
'''

if "/full" not in content:
    # Insert before the last route (DELETE)
    marker = "// DELETE /api/users/:id"
    content = content.replace(marker, new_endpoint + "\n" + marker)
    with open(users_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("users.js: added /full endpoint")
else:
    print("users.js: /full endpoint already exists")

print("Backend changes done.")
