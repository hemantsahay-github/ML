# Auth Testing Playbook

Step 1: MongoDB Verification
- mongosh, use <database_name>, db.users.find({role:"admin"}).pretty()
- Verify bcrypt hash starts with $2b$
- Indexes: users.email (unique), login_attempts.identifier, password_reset_tokens.expires_at (TTL)

Step 2: API Testing
- curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"admin123"}'
- cat cookies.txt
- curl -b cookies.txt http://localhost:8001/api/auth/me

Login sets access_token and refresh_token cookies (httpOnly). /me returns same user.
