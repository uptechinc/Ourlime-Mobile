---
name: oop-service-architecture
description: Design patterns and best practices for creating Object-Oriented TypeScript services in React Native.
---

# OOP Service Architecture Skill

This skill provides guidelines for implementing Object-Oriented service patterns in Ourlime Mobile.

## Core Pattern
All domain services should be structured as TypeScript classes with encapsulated state, static `getInstance()` singletons, or clear public method interfaces.

```typescript
export class RelationshipService {
  private static instance: RelationshipService;

  private constructor() {}

  public static getInstance(): RelationshipService {
    if (!RelationshipService.instance) {
      RelationshipService.instance = new RelationshipService();
    }
    return RelationshipService.instance;
  }

  public async fetchRelationshipStatus(userId1: string, userId2: string): Promise<RelationshipStatus> {
    // API logic & transformations
  }
}

export const relationshipService = RelationshipService.getInstance();
```
