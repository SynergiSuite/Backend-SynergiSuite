# Backend-SynergiSuite Flow Diagram

This diagram is derived from the current NestJS codebase under `src/`.

## Application Flow

```mermaid
flowchart TD
    A["Client App / Frontend"] --> B["NestJS API<br/>main.ts<br/>Port 3002"]
    B --> C["AppModule"]

    C --> D["Auth Controller"]
    C --> E["User Controller"]
    C --> F["Business Controller"]
    C --> G["Teams Controller"]
    C --> H["Projects Controller"]
    C --> I["Clients Controller"]
    C --> J["Milestone Controller"]
    C --> K["Roles / Category Controllers"]

    D --> L["Guards<br/>userExist, userAlreadyExist,<br/>JwtGuard, userNotVerified"]
    E --> M["Guards<br/>JwtGuard, JwtWithVerificationGuard"]
    F --> N["Guards<br/>JwtGuard, IsVerifiedGuard,<br/>business invitation guards"]
    G --> O["Guards<br/>JwtGuard, IsVerifiedGuard,<br/>roleGuard, team guards"]
    H --> P["Guards<br/>JwtGuard, IsVerifiedGuard,<br/>roleGuard, project/task guards"]
    I --> Q["Guards<br/>JwtGuard, IsVerifiedGuard,<br/>roleGuard, client guards"]
    J --> R["Guards<br/>JwtGuard, roleGuard,<br/>milestone guards"]

    L --> S["AuthService"]
    M --> T["UserService"]
    N --> U["BusinessService"]
    O --> V["TeamsService"]
    P --> W["ProjectsService"]
    Q --> X["ClientsService"]
    R --> Y["MilestoneService"]
    K --> Z["RolesService / CategoryService"]

    S --> AA["TypeORM Repositories"]
    T --> AA
    U --> AA
    V --> AA
    W --> AA
    X --> AA
    Y --> AA
    Z --> AA

    AA --> AB["PostgreSQL"]

    S --> AC["RedisService"]
    T --> AC
    U --> AC
    AC --> AD["Redis / Upstash"]

    T --> AE["EmailService"]
    U --> AE
    AE --> AF["Mailer Templates + SMTP"]

    AB --> AG["JSON API Response"]
    AD --> AG
    AF --> AG
    AG --> A
```

## Core Business Journey

```mermaid
flowchart LR
    A["User Signup<br/>POST /auth/new"] --> B["AuthService.create"]
    B --> C["Hash password + create JWT"]
    C --> D["Save User"]

    D --> E["Request verification<br/>POST /user/request-verify-email"]
    E --> F["Generate OTP in Redis"]
    F --> G["Send verification email"]
    G --> H["Verify email<br/>PATCH /auth/verify-email"]

    H --> I["Login<br/>POST /auth/login"]
    I --> J["JWT issued"]

    J --> K["Register business<br/>POST /business/register"]
    K --> L["Create Business + assign owner role"]

    L --> M["Invite employee<br/>POST /business/invite"]
    M --> N["Store invitation token in Redis"]
    N --> O["Send invitation email"]
    O --> P["Employee joins business<br/>POST /business/join-business"]

    P --> Q["Create teams / clients"]
    Q --> R["Create project"]
    R --> S["Assign teams to project"]
    S --> T["Create milestones"]
    T --> U["Create tasks"]
    U --> V["Update task status / priority / due date"]
```

## Main Domain Relationships

```mermaid
erDiagram
    BUSINESS ||--o{ USER : has
    ROLE ||--o{ USER : assigns
    CATEGORY ||--o{ BUSINESS : classifies
    BUSINESS ||--o{ TEAM : owns
    USER ||--o{ TEAM : leads
    TEAM ||--o{ TEAM_MEMBER : contains
    USER ||--o{ TEAM_MEMBER : joins
    BUSINESS ||--o{ CLIENT : owns
    BUSINESS ||--o{ PROJECT : owns
    CLIENT ||--o{ PROJECT : sponsors
    PROJECT ||--o{ MILESTONE : contains
    PROJECT ||--o{ TASK : contains
    MILESTONE ||--o{ TASK : groups
    TEAM }o--o{ PROJECT : assigned_to
    TEAM }o--o{ TASK : works_on
```

## Notes

- Authentication is JWT-based through `JwtStrategy` and `JwtGuard`.
- Verification codes and invitation tokens are stored in Redis with expiry.
- Most business, team, project, client, and milestone routes are protected by layered guards before service execution.
- Persistent data is handled through TypeORM repositories backed by PostgreSQL.
