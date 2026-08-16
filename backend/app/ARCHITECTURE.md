# Backend structure

The backend uses a layered, domain-oriented layout. Public URL paths and API
behaviour remain compatible with the previous `app.modules` implementation.

```text
app/
├── api/
│   ├── admin/          # HR and super-admin HTTP routes
│   └── user/           # candidate, interviewer and public HTTP routes
├── services/
│   ├── account/        # authentication, users and notifications
│   ├── recruitment/    # jobs, applications, interviews and offers
│   ├── talent/         # candidate profile and talent pool
│   ├── content/        # announcements and managed public content
│   ├── operations/     # audit, reports, calendar and data jobs
│   ├── documents/      # spreadsheet and PDF generation
│   ├── email/          # email delivery adapter
│   └── database/       # SQLAlchemy session and repositories
├── models/             # SQLAlchemy entities, split by business domain
├── schemas/            # Pydantic request/response contracts by domain
├── utils/              # stateless shared helpers and response presenters
├── core/               # configuration, security, audit and permissions
├── workers/            # asynchronous task entrypoints
├── storage/            # object storage adapters
├── agents/             # matching agent implementations
└── modules/            # one-file backward-compatible import aliases
```

## Dependency direction

The intended dependency flow is:

```text
api -> domain services -> database/models/core/adapters
api -> schemas
domain services -> database/schemas/models/core/utils/adapters
workers -> services
```

- `api` owns URL prefixes, HTTP methods, response models and router assembly.
- Domain `services` own use cases, validation, transactions and business state changes.
- `services/database` owns the engine, session factory and reusable persistence
  queries. Repositories do not commit; domain services own transaction boundaries.
- `services/email` owns the email adapter and delivery-specific behavior.
- `models` contains persistence entities only. ORM models must not import API or services.
- `schemas` contains transport contracts only. Schemas must not perform database access.
- `utils` is for stateless reusable helpers. Stateful business logic belongs in services.
- `core` contains shared configuration, authentication, audit and permission infrastructure.

## Admin and user API boundary

`api/admin` contains endpoints under `/api/v1/admin` and operations restricted to
HR, super-admin or internal interviewers. `api/user` contains candidate endpoints,
authentication, notifications and explicitly public endpoints. A business domain
may therefore have one route module in each directory while sharing one service.

## Adding a feature

1. Add or update the ORM entity in the matching `models/<domain>.py` file.
2. Add transport contracts to `schemas/<domain>.py` and export them from
   `schemas/__init__.py`.
3. Implement the use case in the matching `services/<group>/<domain>.py` file.
   Put reusable database-only queries in `services/database/<domain>_repository.py`.
4. Register the HTTP operation in `api/admin/<domain>.py` or
   `api/user/<domain>.py`, then include its router in that side's `__init__.py`.
5. Add endpoint tests. Do not add new implementation code to `app/modules`.

## Compatibility layer

`app.modules` is now a single compatibility entrypoint because external scripts
may still patch task objects through old imports. It aliases domain services and
exposes the new router objects. New code must import from `app.api` or the concrete
`app.services.<group>` package. The compatibility package can be removed after
downstream imports have migrated.
