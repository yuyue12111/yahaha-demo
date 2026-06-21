-- Demo OAuth IdP（本地仿第三方登录，演示授权回调 + 账号绑定）：新增 AuthProvider 枚举值 DEMO。
-- Postgres 12+ 允许在事务内 ADD VALUE（本项目 postgres:16）。IF NOT EXISTS 保幂等（重复 deploy 无副作用）。
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'DEMO';
