# Register (React Native static port)

## What this is

This is a static-only React Native port of the web registration component from `app/register/page.tsx`. The component renders a multi-step registration form with avatar selection, location details, interests, and identity verification steps.

## Integration Details

### Route Configuration
- **Route Name**: `Register`
- **File Location**: `app/(auth)/register.tsx`
- **Component Import**: `import Register from '../../mobile/Register';`
- **Navigation**: Accessible via `router.push("/(auth)/register")`

### Demo Access
- **Home Screen**: Added "Register Demo" button in the slide-out menu
- **Menu Item ID**: `10`
- **Icon**: `person-add`
- **Navigation**: Routes to `/(auth)/register`

### Mock Data Location
- **File**: `mobile/Register/data.mock.ts`
- **Purpose**: Contains all static data for form fields, avatars, interests, validation rules
- **Integration Point**: Replace mock data with real API calls when implementing backend

### Stubbed Handlers in index.tsx
The following handlers are currently stubbed and need real implementation:
- `handleSubmit()` - Replace with actual registration API
- `validateStep1()` - Implement real form validation
- `validateStep3()` - Implement real form validation
- `handleNextStep()` - Add real navigation logic
- `handlePreviousStep()` - Add real navigation logic
- `handleAvatarSelection()` - Add real avatar selection logic
- File upload handlers (steps 6) - Replace with image picker

## Differences from web

- **Layout**: Converted from web CSS Grid/Flexbox to React Native Flexbox with responsive breakpoints
- **Navigation**: Replaced Next.js router with Pressable components and console.log stubs
- **Forms**: Converted HTML form elements to React Native TextInput components
- **Images**: Replaced Next.js Image with React Native Image component
- **Styling**: Converted Tailwind CSS classes to StyleSheet.create objects
- **Responsiveness**: Uses `useWindowDimensions()` instead of CSS media queries
- **File Uploads**: Replaced HTML file inputs with Pressable placeholders
- **Modals**: Converted web modals to React Native Modal components
- **Animations**: Removed GSAP animations (replaced with static transitions)
- **Validation**: Stubbed all validation functions with console.log placeholders

## How to wire real data later

### Replace mock data
- **Location**: `data.mock.ts` - Replace all mock constants with real API calls
- **Form submission**: `index.tsx` - Replace `handleSubmit()` with actual registration API
- **Validation**: `index.tsx` - Implement real validation in `validateStep1()`, `validateStep3()`, etc.
- **File uploads**: `index.tsx` - Replace file upload placeholders with actual image picker

### Add real handlers
- **Navigation**: Replace `console.log('TODO: Navigate to...')` with actual navigation calls
- **API calls**: Replace `console.log('TODO: ...')` with real API service calls
- **Error handling**: Implement real error states and user feedback
- **Loading states**: Add real loading indicators for async operations

### Key integration points
```typescript
// In index.tsx - Replace these stubs:
const handleSubmit = () => {
  // TODO: Replace with real registration API
  console.log('TODO: Submit registration form');
};

const validateStep1 = (): boolean => {
  // TODO: Replace with real validation logic
  console.log('TODO: Validate step 1');
  return true;
};
```

## Assets included

### Images (already copied to mobile/Register/images/)
- `cartoonAvatarBlackBoy.svg` - Black boy cartoon avatar
- `cartoonAvatarWhiteBoy.svg` - White boy cartoon avatar  
- `cartoonAvatarBlackGirl.svg` - Black girl cartoon avatar
- `cartoonAvatarWhiteGirl.svg` - White girl cartoon avatar
- `realisticAvatarWhiteMan.svg` - White man realistic avatar
- `realisticAvatarBlackWoman.svg` - Black woman realistic avatar
- `check.svg` - Check mark icon for selected avatars
- `transparentLogo.png` - Logo for progress bar

### Icon replacements
Replace Lucide React icons with react-native-vector-icons:
- `ChevronLeft` → `Ionicons.chevron-back`
- `ChevronRight` → `Ionicons.chevron-forward`
- `Phone` → `Ionicons.phone`
- `MapPin` → `Ionicons.location`
- `Globe` → `Ionicons.globe`
- `Home` → `Ionicons.home`
- `Mail` → `Ionicons.mail`

## Props & data contract

### Component Props
```typescript
// No external props - component is self-contained
// All state managed internally
```

### Form Data Type
```typescript
type FormData = {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  gender: string;
  birthday: string;
  password: string;
  confirmPassword: string;
  country: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
  zipCode: string;
  profilePicture: string | null;
  selectedInterests: string[];
};
```

### Mock Data Structure
```typescript
// See data.mock.ts for complete structure
// Includes: formData, avatars, interests, countries, validation rules, etc.
```

## Known gaps / TODOs

### Critical TODOs
- [ ] Implement real form validation logic
- [ ] Add actual API integration for registration
- [ ] Replace file upload placeholders with image picker
- [ ] Add real navigation integration
- [ ] Implement proper error handling and user feedback
- [ ] Add loading states for async operations

### Enhancement TODOs
- [ ] Add form persistence (save draft on step changes)
- [ ] Implement proper phone number validation
- [ ] Add accessibility improvements
- [ ] Add haptic feedback for interactions
- [ ] Implement proper keyboard handling
- [ ] Add form field auto-focus

### Integration TODOs
- [ ] Connect to authentication service
- [ ] Add real-time validation (email/username availability)
- [ ] Implement proper file upload with progress
- [ ] Add push notification setup
- [ ] Connect to analytics tracking

## Responsiveness notes

### Breakpoints
- **Phone**: `width < 768px` - Single column layout, smaller spacing
- **Tablet**: `width >= 768px` - Two-column sections, larger spacing

### Responsive tokens
```typescript
const isTablet = screenWidth >= TABLET_MIN;
const spacing = isTablet ? 12 : 8;
const fontScale = Math.min(PixelRatio.getFontScale(), isTablet ? 1.2 : 1.0);
const contentMaxWidth = isTablet ? 900 : screenWidth;
```

### Layout adaptations
- **Form fields**: Phone = single column, Tablet = two columns for name/password fields
- **Avatar grid**: Phone = single column, Tablet = two columns
- **Button layout**: Phone = stacked, Tablet = side-by-side
- **Content width**: Capped at 900px on large tablets
- **Font scaling**: Respects system font size with 1.2x cap on tablets

### Touch targets
- All interactive elements meet 44x44pt minimum touch target
- Proper spacing between touch elements
- Clear visual feedback for pressed states

### Dynamic Type support
- Text scales with system font size settings
- Layout adapts to larger text sizes
- Maintains readability across all font scales

