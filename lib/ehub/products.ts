export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  description?: string;
  discountPercentage?: number;
};

export type Category = {
  name: string;
  image: string;
};

export type Freelancer = {
  id: string;
  name: string;
  title: string;
  hourlyRate: number;
  image: string;
  rating: number;
  reviews: number;
  skills: string[];
  available: boolean;
  completedJobs: number;
  responseTime: string;
};

export const PRODUCTS: Product[] = [
  { id: '1', name: 'Wireless Noise Cancelling Headphones', price: 129.99, discountPercentage: 35, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop', category: 'Electronics', rating: 4.5, reviews: 12453, description: 'Experience premium audio with active noise cancellation' },
  { id: '2', name: 'Smart Watch Fitness Tracker', price: 199.99, discountPercentage: 20, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop', category: 'Electronics', rating: 4.3, reviews: 8932, description: 'Track your health and fitness goals' },
  { id: '3', name: 'Organic Cotton T-Shirt', price: 24.99, discountPercentage: 15, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop', category: 'Fashion', rating: 4.7, reviews: 3421, description: 'Sustainable and comfortable everyday wear' },
  { id: '4', name: 'Professional DSLR Camera', price: 799.99, discountPercentage: 10, image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&h=500&fit=crop', category: 'Electronics', rating: 4.8, reviews: 5632, description: 'Capture stunning photos with professional quality' },
  { id: '5', name: 'Ergonomic Office Chair', price: 249.99, discountPercentage: 25, image: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500&h=500&fit=crop', category: 'Home & Garden', rating: 4.6, reviews: 7821, description: 'Ultimate comfort for long work hours' },
  { id: '6', name: 'Yoga Mat Non-Slip Premium', price: 34.99, discountPercentage: 30, image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&h=500&fit=crop', category: 'Sports', rating: 4.4, reviews: 2156, description: 'Perfect for yoga and fitness exercises' },
  { id: '7', name: 'Bluetooth Speaker Waterproof', price: 59.99, discountPercentage: 40, image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop', category: 'Electronics', rating: 4.5, reviews: 9845, description: 'Take your music anywhere' },
  { id: '8', name: 'Running Shoes Performance', price: 89.99, discountPercentage: 18, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=500&fit=crop', category: 'Sports', rating: 4.6, reviews: 6234, description: 'Designed for maximum comfort and speed' },
  { id: '9', name: 'Coffee Maker 12-Cup Programmable', price: 79.99, discountPercentage: 22, image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500&h=500&fit=crop', category: 'Home & Garden', rating: 4.3, reviews: 4521, description: 'Wake up to fresh coffee every morning' },
  { id: '10', name: 'Water Resistant Laptop Backpack', price: 49.99, discountPercentage: 30, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&h=500&fit=crop', category: 'Fashion', rating: 4.7, reviews: 8765, description: 'Perfect for work, school, or travel' },
];

export const CATEGORIES: Category[] = [
  { name: 'All', image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop' },
  { name: 'Electronics', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop' },
  { name: 'Fashion', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop' },
  { name: 'Home & Garden', image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400&h=300&fit=crop' },
  { name: 'Sports', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=300&fit=crop' },
  { name: 'Freelancers', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop' },
];

export const FREELANCERS: Freelancer[] = [
  { id: 'f1', name: 'Sarah Johnson', title: 'Full Stack Developer', hourlyRate: 85, image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', rating: 4.9, reviews: 127, skills: ['React', 'Node.js', 'TypeScript', 'AWS'], available: true, completedJobs: 243, responseTime: '1 hour' },
  { id: 'f2', name: 'Michael Chen', title: 'UI/UX Designer', hourlyRate: 75, image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', rating: 4.8, reviews: 95, skills: ['Figma', 'Adobe XD', 'Prototyping'], available: true, completedJobs: 178, responseTime: '30 min' },
  { id: 'f3', name: 'Emily Rodriguez', title: 'Content Writer & SEO', hourlyRate: 45, image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', rating: 5.0, reviews: 203, skills: ['SEO Writing', 'Copywriting', 'Technical'], available: false, completedJobs: 456, responseTime: '2 hours' },
  { id: 'f4', name: 'David Kim', title: 'Mobile App Developer', hourlyRate: 95, image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', rating: 4.9, reviews: 142, skills: ['React Native', 'iOS', 'Android'], available: true, completedJobs: 198, responseTime: '1 hour' },
  { id: 'f5', name: 'Jessica Martinez', title: 'Digital Marketer', hourlyRate: 65, image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop', rating: 4.7, reviews: 88, skills: ['Social Media', 'Google Ads', 'Analytics'], available: true, completedJobs: 167, responseTime: '45 min' },
];
