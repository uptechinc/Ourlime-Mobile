export type User = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  profileImage?: string;
  bio?: string;
  unreadNotificationCount?: number;
  // other fields...
}; 