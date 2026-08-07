# Object-Oriented Architecture (OOP) Rules

## 1. Service Layer Pattern
- Business logic, data operations, and API communication belong inside OOP Service classes.
- Service classes use singleton instances (e.g. `ChatService.getInstance()`) or class methods.
- UI components delegate data operations to services instead of writing inline fetch/transformation logic.

## 2. Separation of Concerns
- **UI Component**: View presentation & event triggers.
- **Custom Hook**: React lifecycle & state binding.
- **Service Class**: Domain logic, data fetching, transformation, and API calls.
