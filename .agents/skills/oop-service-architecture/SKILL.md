---
name: oop-service-architecture
description: Design patterns and best practices for creating Object-Oriented TypeScript services in React Native.
---

# OOP Service Architecture Skill

## Scope Control

Apply this architecture within the user’s explicit request. Do not turn a focused change into an unrelated service refactor; report adjacent opportunities rather than implementing them without authorization.

This skill provides guidelines and design rules for implementing Object-Oriented service patterns in Ourlime Mobile.

---

## 1. Core Engineering Philosophy

### 1.1 The Mandatory Importance of Object-Oriented Programming (OOP)
Ourlime Mobile enforces a **Service-Oriented Object-Oriented Programming (OOP)** architecture across business logic, state caching, API integration, and domain services.

- **Encapsulation**: Domain rules, API calls, caching layers, and validation live strictly inside plain TypeScript service classes.
- **Single Responsibility**: Service classes own distinct domain aggregates (`AuthService`, `RelationshipService`, `ChatService`, `CommunityService`, `NotificationService`). They expose a clean public API for UI components and custom hooks.
- **Layer Independence**:
  - UI Components serve purely as presentation views.
  - Custom React Hooks manage React lifecycle and delegate to service instances.
  - Service classes own API calls, SQLite/AsyncStorage caching, validation, error normalization, and data formatting.

---

## 2. Core Service Pattern

All domain services should be structured as TypeScript classes with encapsulated state, static `getInstance()` singletons, and clear public method interfaces:

```typescript
import { ApiService } from './ApiService';
import { LocalCacheService } from './LocalCacheService';
import { DiagnosticLogService } from './DiagnosticLogService';

export class RelationshipService {
  private static instance: RelationshipService;
  private readonly apiService = ApiService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): RelationshipService {
    if (!RelationshipService.instance) {
      RelationshipService.instance = new RelationshipService();
    }
    return RelationshipService.instance;
  }

  public async fetchRelationshipStatus(userId1: string, userId2: string): Promise<RelationshipStatus> {
    try {
      // API call, caching, error normalization
      const response = await this.apiService.request<RelationshipApiResponse>(
        `/api/relationships/status?userId1=${userId1}&userId2=${userId2}&type=all`,
        { authenticated: true }
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error('RelationshipService', 'fetchRelationshipStatus', error);
      throw error;
    }
  }
}

export const relationshipService = RelationshipService.getInstance();
```

---

## 3. Service Decision Framework

- **Default: extend, don't create** — inspect existing domain services first and add methods to an existing class before introducing a new file.
- **Single Instance**: Always use `private constructor()` with `public static getInstance()` to prevent multiple uncoordinated instances.
- **Composition**: Services instantiate dependencies (like `ApiService`, `LocalCacheService`, `DiagnosticLogService`) through their singletons.

---

## 4. Verification Check

Verify full TypeScript compilation and discipline rules:

```bash
cmd /c "node_modules\.bin\tsc --noEmit && node scripts/check-discipline.cjs"
```
