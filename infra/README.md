# infra/ —— v2 中间件基础设施（Docker）

本目录集中管理 HR ATS v2 的全部中间件，满足“PostgreSQL + Redis + MinIO 用 Docker 管理到一个目录”的要求。

## 包含服务

| 服务 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| postgres | postgres:16 | 5432 | 主数据库 `hr_ats` |
| redis | redis:7 | 6380 (容器内 6379) | Celery broker / result backend |

> **端口说明**：本机 6379 已被另一个项目的 Redis（`mineru-web-redis`）占用，因此对外映射为 **6380**。
> 若你的环境 6379 空闲，把 `docker-compose.yml` 里 redis 的 `"6380:6379"` 改回 `"6379:6379"`，
> 并将 `backend/.env` 的 `REDIS_URL` 改回 `redis://localhost:6379/0` 即可。
| minio | minio/minio | 9000 (S3 API) / 9001 (Console) | 简历对象存储，桶 `hr-resumes` |
| adminer | adminer | 8080 | Postgres 可视化（开发用） |
| redisinsight | redis/redisinsight | 5540 | Redis 可视化（开发用） |

数据全部使用 **Docker 命名卷**（`pgdata` / `redisdata` / `miniodata`），不在项目目录内，避免 Windows 绑定挂载权限问题。

## 常用命令

```bash
# 启动全部中间件（后台）
docker compose up -d

# 查看状态 / 日志
docker compose ps
docker compose logs -f postgres

# 停止（保留数据）
docker compose down

# 停止并清空所有数据（慎用）
docker compose down -v
```

## 访问

- MinIO Console: http://localhost:9001  （账号见 `.env`）
- Adminer: http://localhost:8080  （系统 PostgreSQL，账号见 `.env`）
- RedisInsight: http://localhost:5540

## 与后端对齐

后端 `backend/.env` 中的 `DATABASE_URL` / `REDIS_URL` / `MINIO_*` 必须与本目录 `.env` 的账号、端口、桶名保持一致。
