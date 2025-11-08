// Mock data for Register component - static-only rendering

// Types for mock data
type Avatar = {
  id: string;
  name: string;
  image: any; // React Native Image source
};

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

export const mockData: {
  formData: FormData;
  cartoonAvatars: Avatar[];
  realisticAvatars: Avatar[];
  checkIcon: any;
  logo: any;
  interests: string[];
  countries: string[];
  genders: string[];
  errorMessages: Record<string, string>;
  successMessages: Record<string, string>;
  termsText: string;
  privacyText: string;
  fileUploads: Record<string, any>;
  validation: Record<string, any>;
  steps: { id: number; title: string; description: string }[];
  loadingStates: Record<string, boolean>;
  emptyStates: Record<string, string>;
} = {
  // Form data with default values
  formData: {
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe123',
    email: 'john.doe@example.com',
    gender: 'Male',
    birthday: '01/15/1990',
    password: 'password123',
    confirmPassword: 'password123',
    country: 'United States',
    phone: '+1 (555) 123-4567',
    city: 'New York',
    address: '123 Main Street',
    postalCode: '10001',
    zipCode: '10001',
    profilePicture: 'cartoonAvatarBlackBoy',
    selectedInterests: ['Technology', 'Sports', 'Music'],
  },

  // Avatar options
  cartoonAvatars: [
    {
      id: 'cartoonAvatarBlackBoy',
      name: 'Black Boy Cartoon',
      image: require('./images/cartoonAvatarBlackBoy.svg'),
    },
    {
      id: 'cartoonAvatarWhiteBoy',
      name: 'White Boy Cartoon',
      image: require('./images/cartoonAvatarWhiteBoy.svg'),
    },
    {
      id: 'cartoonAvatarBlackGirl',
      name: 'Black Girl Cartoon',
      image: require('./images/cartoonAvatarBlackGirl.svg'),
    },
    {
      id: 'cartoonAvatarWhiteGirl',
      name: 'White Girl Cartoon',
      image: require('./images/cartoonAvatarWhiteGirl.svg'),
    },
  ],

  realisticAvatars: [
    {
      id: 'realisticAvatarWhiteMan',
      name: 'White Man Realistic',
      image: require('./images/realisticAvatarWhiteMan.svg'),
    },
    {
      id: 'realisticAvatarBlackWoman',
      name: 'Black Woman Realistic',
      image: require('./images/realisticAvatarBlackWoman.svg'),
    },
  ],

  // Check mark icon for selected avatars
  checkIcon: require('./images/check.svg'),

  // Logo for progress bar
  logo: require('./images/transparentLogo.png'),

  // Interest options
  interests: [
    'Technology',
    'Sports',
    'Music',
    'Art',
    'Travel',
    'Food',
    'Fitness',
    'Gaming',
    'Reading',
    'Photography',
    'Movies',
    'Fashion',
    'Business',
    'Education',
    'Health',
    'Nature',
    'Cooking',
    'Dancing',
    'Writing',
    'Volunteering',
  ],

  // Country list (subset for demo)
  countries: [
    'United States',
    'Canada',
    'United Kingdom',
    'Australia',
    'Germany',
    'France',
    'Spain',
    'Italy',
    'Japan',
    'South Korea',
    'Brazil',
    'Mexico',
    'India',
    'China',
    'Russia',
    'South Africa',
    'Nigeria',
    'Egypt',
    'Argentina',
    'Chile',
  ],

  // Gender options
  genders: ['Male', 'Female', 'Other', 'Prefer not to say'],

  // Error messages
  errorMessages: {
    firstName: 'Please enter your first name.',
    lastName: 'Please enter your last name.',
    userName: 'Please enter your username.',
    email: 'Please enter a valid email address.',
    emailExists: 'This email is already registered.',
    gender: 'Please select a gender.',
    birthday: 'Please select your date of birth.',
    password: 'Password should be at least 6 characters.',
    confirmPassword: 'Passwords do not match.',
    country: 'Please enter your country.',
    phone: 'Please enter a valid phone number.',
    phoneExists: 'This phone number is already registered.',
    terms: 'You must accept the Terms and Conditions',
    privacy: 'You must accept the Privacy Policy',
    general: 'Please check your information and try again.',
  },

  // Success messages
  successMessages: {
    registration: 'Registration successful! Please check your email for verification.',
    emailSent: 'Verification email sent successfully.',
    accountCreated: 'Account created successfully!',
  },

  // Terms and Privacy text (mobile-friendly formatting)
  termsText: `TERMS AND CONDITIONS

Last Updated: January 2024

1. ACCEPTANCE OF TERMS
By accessing and using Ourlime, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by the above, please do not use this service.

2. USE LICENSE
Permission is granted to temporarily download one copy of Ourlime per device for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
• Modify or copy the materials
• Use the materials for any commercial purpose or for any public display
• Attempt to reverse engineer any software contained on Ourlime
• Remove any copyright or other proprietary notations from the materials

3. DISCLAIMER
The materials on Ourlime are provided on an 'as is' basis. Ourlime makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

4. LIMITATIONS
In no event shall Ourlime or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Ourlime, even if Ourlime or an authorized representative has been notified orally or in writing of the possibility of such damage.

5. ACCURACY OF MATERIALS
The materials appearing on Ourlime could include technical, typographical, or photographic errors. Ourlime does not warrant that any of the materials on its website are accurate, complete, or current.

6. LINKS
Ourlime has not reviewed all of the sites linked to our website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Ourlime of the site.

7. MODIFICATIONS
Ourlime may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.

8. GOVERNING LAW
These terms and conditions are governed by and construed in accordance with the laws of the United States and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.

9. USER ACCOUNTS
When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password and for all activities that occur under your account.

10. PROHIBITED USES
You may not use our service:
• For any unlawful purpose or to solicit others to perform unlawful acts
• To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances
• To infringe upon or violate our intellectual property rights or the intellectual property rights of others
• To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate
• To submit false or misleading information
• To upload or transmit viruses or any other type of malicious code

By using Ourlime, you agree to these terms and conditions.`,

  privacyText: `PRIVACY POLICY

Last Updated: January 2024

1. INFORMATION WE COLLECT
We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support. This includes:
• Personal information (name, email, phone number)
• Profile information (username, profile picture, bio)
• Content you create (posts, comments, messages)
• Usage data (how you interact with our services)
• Device information (IP address, device type, operating system)

2. HOW WE USE YOUR INFORMATION
We use the information we collect to:
• Provide, maintain, and improve our services
• Process transactions and send related information
• Send technical notices, updates, and support messages
• Respond to your comments and questions
• Communicate with you about products, services, and events
• Monitor and analyze trends and usage
• Personalize and improve your experience

3. INFORMATION SHARING
We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except in the following circumstances:
• With your explicit consent
• To comply with legal obligations
• To protect our rights and safety
• In connection with a business transfer
• With service providers who assist us in operating our platform

4. DATA SECURITY
We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:
• Encryption of data in transit and at rest
• Regular security assessments
• Access controls and authentication
• Secure data storage and processing

5. COOKIES AND TRACKING
We use cookies and similar tracking technologies to:
• Remember your preferences and settings
• Analyze how you use our services
• Provide personalized content and advertisements
• Improve our services and user experience

6. THIRD-PARTY SERVICES
Our services may contain links to third-party websites or services that are not owned or controlled by Ourlime. We are not responsible for the privacy practices of these third parties.

7. CHILDREN'S PRIVACY
Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.

8. YOUR RIGHTS
You have the right to:
• Access your personal information
• Correct inaccurate information
• Delete your personal information
• Object to processing of your information
• Data portability
• Withdraw consent

9. DATA RETENTION
We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, unless a longer retention period is required by law.

10. INTERNATIONAL TRANSFERS
Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information.

11. CHANGES TO THIS POLICY
We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.

12. CONTACT US
If you have any questions about this privacy policy or our privacy practices, please contact us at:
• Email: privacy@ourlime.com
• Address: Ourlime Privacy Team, 123 Main Street, City, State 12345

By using Ourlime, you agree to the collection and use of information in accordance with this policy.`,

  // File upload placeholders
  fileUploads: {
    facePhoto: {
      fileName: 'face_photo.jpg',
      size: '2.1 MB',
      status: 'pending',
    },
    idFront: {
      fileName: 'id_front.jpg',
      size: '1.8 MB',
      status: 'pending',
    },
    idBack: {
      fileName: 'id_back.jpg',
      size: '1.9 MB',
      status: 'pending',
    },
  },

  // Validation rules
  validation: {
    password: {
      minLength: 6,
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: false,
      requireSpecialChars: false,
    },
    phone: {
      minLength: 10,
      maxLength: 15,
    },
    username: {
      minLength: 3,
      maxLength: 20,
      allowedChars: /^[a-zA-Z0-9_]+$/,
    },
  },

  // Step configuration
  steps: [
    { id: 1, title: 'Personal Information', description: 'Basic account details' },
    { id: 2, title: 'Avatar Selection', description: 'Choose your profile picture' },
    { id: 3, title: 'Location Details', description: 'Where are you located?' },
    { id: 4, title: 'Interests', description: 'Tell us about your interests' },
    { id: 5, title: 'Authentication', description: 'Complete your registration' },
    { id: 6, title: 'Verification', description: 'Upload ID documents' },
  ],

  // Loading states
  loadingStates: {
    checkingEmail: false,
    checkingUsername: false,
    checkingPhone: false,
    submitting: false,
    uploading: false,
  },

  // Empty states
  emptyStates: {
    noAvatars: 'No avatars available',
    noInterests: 'No interests selected',
    noFiles: 'No files uploaded',
  },
};
