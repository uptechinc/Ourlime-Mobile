import { Event } from '@/types/eventTypes';

export const DUMMY_EVENTS: Event[] = [
    {
        id: '1',
        title: 'GreenTech Summit',
        startDate: '2024-09-12',
        endDate: '2024-09-14',
        time: '09:00 AM',
        location: 'Eco Center, Colorado',
        description: 'Explore sustainable technologies and green energy.',
        summary: 'A summit exploring cutting-edge sustainable technologies',
        userId: 'admin_user_id', 
        likeCount: 150,
        recurrence: 'none',
        userRSVP: false,
        media: [
            {
                type: 'image',
                url: 'https://images.unsplash.com/photo-1637244875663-2657638a2316',
            },
        ],
    },
    {
        id: '2',
        title: 'UX & UI Design Marathon',
        startDate: '2024-10-05',
        endDate: '2024-10-07',
        time: '10:00 AM',
        location: 'Design Hub, Berlin',
        description: 'A collaborative event for designers to create and showcase new UI/UX prototypes.',
        summary: 'Design marathon for UI/UX professionals',
        userId: 'admin_user_id', 
        likeCount: 220,
        recurrence: 'none',
        userRSVP: true,
        media: [
            {
                type: 'image',
                url: 'https://images.unsplash.com/photo-1569937704472-5f3502ac3247',
            },
        ],
    },
    {
        id: '3',
        title: 'AI & Machine Learning Workshop',
        startDate: '2024-11-15',
        endDate: '2024-11-17',
        time: '01:00 PM',
        location: 'San Francisco AI Labs',
        description: 'Hands-on training covering deep learning, neural networks, and model deployment.',
        summary: 'Advanced AI and machine learning workshop',
        userId: 'admin_user_id', 
        likeCount: 80,
        recurrence: 'none',
        userRSVP: false,
        media: [
            {
                type: 'image',
                url: 'https://images.unsplash.com/photo-1581091870628-1f18f6f13efe',
            },
        ],
    },
    {
        id: '4',
        title: 'Music & Tech Festival',
        startDate: '2024-08-20',
        endDate: '2024-08-22',
        time: '06:00 PM',
        location: 'Downtown Arena',
        description: 'Live music meets cutting-edge AR/VR experiences and interactive tech installations.',
        summary: 'Innovative music and technology festival',
        userId: 'admin_user_id', 
        likeCount: 340,
        recurrence: 'none',
        userRSVP: true,
        media: [
            {
                type: 'video',
                url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
            },
            {
                type: 'image',
                url: 'https://images.unsplash.com/photo-1609008802874-3c27bdbe2c83',
            },
        ],
    },
];
