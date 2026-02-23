# DOCQR v2 - Development Guide

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Docker & Docker Compose
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/ranga-tec/DocQR.git
cd DocQR/docqr-v2

# Install all dependencies (from root)
npm install

# Start infrastructure services
docker compose up -d postgres redis minio

# Setup database
cd packages/database
npx prisma migrate dev
npx prisma db seed
cd ../..

# Start backend
cd apps/core
npm run start:dev

# In another terminal - start frontend
cd apps/web
npm run dev
```

---

## Project Structure

```
docqr-v2/
├── apps/
│   ├── core/           # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/    # Feature modules
│   │   │   ├── common/     # Shared utilities
│   │   │   ├── config/     # Configuration
│   │   │   └── main.ts     # Entry point
│   │   ├── test/           # E2E tests
│   │   └── package.json
│   └── web/            # React frontend
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── lib/
│       └── package.json
├── packages/
│   ├── database/       # Prisma schema & migrations
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── package.json
│   └── shared/         # Shared types & utilities
│       └── package.json
├── docker/             # Docker configurations
├── docs/               # Documentation
├── .env.example        # Environment template
└── package.json        # Root package.json
```

---

## Development Workflow

### Daily Development

```bash
# Pull latest changes
git pull origin main

# Update dependencies (if package.json changed)
npm install

# Run migrations (if schema changed)
cd packages/database && npx prisma migrate dev

# Start services
docker compose up -d
npm run dev  # Starts both backend and frontend
```

### Working on Features

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes...

# Run linting
npm run lint

# Run tests
npm run test

# Commit changes
git add .
git commit -m "feat: add my feature"

# Push and create PR
git push origin feature/my-feature
```

---

## Code Style

### TypeScript Guidelines

```typescript
// Use explicit types for function parameters and returns
function createDocket(data: CreateDocketDto): Promise<Docket> {
  // ...
}

// Use interfaces for objects
interface DocketQueryParams {
  status?: DocketStatus;
  page?: number;
  limit?: number;
}

// Use enums for fixed values
enum DocketStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  // ...
}

// Prefer const assertions for literal types
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
type Priority = typeof PRIORITIES[number];
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (modules) | kebab-case | `dockets.service.ts` |
| Classes | PascalCase | `DocketsService` |
| Functions | camelCase | `createDocket` |
| Variables | camelCase | `docketNumber` |
| Constants | SCREAMING_SNAKE | `MAX_FILE_SIZE` |
| Interfaces | PascalCase | `DocketQueryParams` |
| Enums | PascalCase | `DocketStatus` |
| Database tables | snake_case | `docket_attachments` |

### File Organization

```typescript
// Service file structure
import { Injectable } from '@nestjs/common';  // Framework imports first
import { PrismaService } from '../prisma';    // Internal imports
import { CreateDocketDto } from './dto';      // Local imports

@Injectable()
export class DocketsService {
  // Constructor
  constructor(private readonly prisma: PrismaService) {}

  // Public methods first
  async create(dto: CreateDocketDto): Promise<Docket> {}
  async findAll(): Promise<Docket[]> {}

  // Private methods last
  private generateDocketNumber(): string {}
}
```

---

## Testing

### Backend Tests

```bash
# Run all tests
cd apps/core
npm run test

# Run with coverage
npm run test:cov

# Run specific test file
npm run test -- dockets.service.spec.ts

# Run E2E tests
npm run test:e2e
```

### Writing Tests

```typescript
// dockets.service.spec.ts
describe('DocketsService', () => {
  let service: DocketsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocketsService,
        {
          provide: PrismaService,
          useValue: {
            docket: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(DocketsService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create a docket with generated number', async () => {
      const dto = { subject: 'Test', docketTypeId: 'uuid' };
      const expected = { id: 'uuid', docketNumber: 'DOC/2024/000001', ...dto };

      jest.spyOn(prisma.docket, 'create').mockResolvedValue(expected);

      const result = await service.create(dto, 'userId');

      expect(result.docketNumber).toMatch(/^DOC\/\d{4}\/\d{6}$/);
    });
  });
});
```

### Frontend Tests

```bash
cd apps/web

# Run tests
npm run test

# Run with UI
npm run test:ui

# Run E2E tests
npm run test:e2e
```

---

## Database

### Schema Changes

```bash
cd packages/database

# Create migration
npx prisma migrate dev --name add_new_field

# Apply migrations
npx prisma migrate deploy

# Reset database (DESTRUCTIVE)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate
```

### Prisma Studio

```bash
# Open visual database browser
npx prisma studio
```

### Seeding

```bash
# Run seed script
npx prisma db seed
```

Edit seed data in `packages/database/prisma/seed.ts`.

---

## API Development

### Adding a New Endpoint

1. **Create DTO** (Data Transfer Object):

```typescript
// dto/create-item.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

2. **Add Service Method**:

```typescript
// items.service.ts
async create(dto: CreateItemDto, userId: string): Promise<Item> {
  return this.prisma.item.create({
    data: {
      ...dto,
      createdById: userId,
    },
  });
}
```

3. **Add Controller Endpoint**:

```typescript
// items.controller.ts
@Post()
@UseGuards(JwtAuthGuard)
@Permissions('item:create')
async create(
  @Body() dto: CreateItemDto,
  @CurrentUser() user: User,
): Promise<Item> {
  return this.itemsService.create(dto, user.id);
}
```

4. **Update Swagger**:

```typescript
@ApiOperation({ summary: 'Create item' })
@ApiResponse({ status: 201, type: ItemResponseDto })
@Post()
async create(...) {}
```

---

## Frontend Development

### Creating a New Page

1. **Create Page Component**:

```typescript
// pages/items/ItemsList.tsx
export default function ItemsList() {
  const { data, isLoading, error } = useItems();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <h1>Items</h1>
      {data?.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

2. **Add Route**:

```typescript
// App.tsx
<Route path="/items" element={<ItemsList />} />
```

3. **Create API Hook**:

```typescript
// hooks/useItems.ts
export function useItems(params?: ItemQueryParams) {
  return useQuery({
    queryKey: ['items', params],
    queryFn: () => itemsApi.list(params),
  });
}
```

4. **Add Navigation**:

```typescript
// components/Sidebar.tsx
<NavLink to="/items">Items</NavLink>
```

---

## Debugging

### Backend Debugging

**VS Code Launch Configuration:**

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "args": ["${workspaceFolder}/apps/core/src/main.ts"],
      "cwd": "${workspaceFolder}/apps/core",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

**Console Logging:**

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(MyService.name);

this.logger.log('Info message');
this.logger.debug('Debug message');
this.logger.error('Error message', error.stack);
```

### Frontend Debugging

**React DevTools**: Install browser extension

**Query DevTools**:

```typescript
// main.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

---

## Git Workflow

### Branch Naming

```
feature/description    # New features
fix/description        # Bug fixes
refactor/description   # Code refactoring
docs/description       # Documentation
chore/description      # Maintenance tasks
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add docket forwarding
fix: resolve attachment upload issue
docs: update API documentation
refactor: extract validation logic
chore: update dependencies
```

### Pull Request Process

1. Create branch from `main`
2. Make changes with atomic commits
3. Push branch and create PR
4. Wait for CI checks to pass
5. Request review
6. Address feedback
7. Squash and merge

---

## Environment Variables

### Adding New Variables

1. **Add to `.env.example`**:

```bash
NEW_FEATURE_ENABLED=false
NEW_SERVICE_API_KEY=
```

2. **Add to configuration**:

```typescript
// config/configuration.ts
export default () => ({
  newFeature: {
    enabled: process.env.NEW_FEATURE_ENABLED === 'true',
    apiKey: process.env.NEW_SERVICE_API_KEY,
  },
});
```

3. **Use in service**:

```typescript
constructor(private config: ConfigService) {
  this.enabled = this.config.get<boolean>('newFeature.enabled');
}
```

4. **Document in `.env.example`** with comments.

---

## Common Tasks

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update all (careful!)
npm update

# Update specific package
npm install package@latest
```

### Generate Types from API

```bash
# If using OpenAPI generator
npx openapi-generator-cli generate \
  -i http://localhost:3000/api-json \
  -g typescript-axios \
  -o apps/web/src/api
```

### Database Reset

```bash
cd packages/database

# Full reset (drops all data)
npx prisma migrate reset

# Just re-seed
npx prisma db seed
```

---

## Troubleshooting

### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
npm install
```

### Prisma client out of sync

```bash
cd packages/database
npx prisma generate
```

### Port already in use

```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Docker containers not starting

```bash
# Check logs
docker compose logs postgres
docker compose logs redis

# Restart
docker compose down
docker compose up -d
```
