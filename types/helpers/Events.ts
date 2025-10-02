import { collection, getDocs, query, where, orderBy, Timestamp, getDoc, doc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Event } from '@/types/eventTypes';

export const fetchEvents = async (communityVariantId?: string) => {
    try {
        let eventsQuery;
        
        if (communityVariantId) {
            eventsQuery = query(
                collection(db, 'events'),
                where('communityVariantId', '==', communityVariantId),
                orderBy('startDate', 'desc')
            );
        } else {
            eventsQuery = query(
                collection(db, 'events'),
                orderBy('startDate', 'desc')
            );
        }

        const querySnapshot = await getDocs(eventsQuery);
        const events = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as Omit<Event, 'id'> & { userId: string };
            const userId = data.userId;
            let organizer = { name: 'Unknown', image: '/images/transparentLogo.png' };

            if (userId) {
                // Fetch user document
                const userDocRef = doc(db, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                let name = 'Unknown';
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    name = userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.userName || 'Unknown';
                }
                // Fetch profile image set as 'profile'
                const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', userId),
                    where('setAs', '==', 'profile')
                );
                const setAsSnapshot = await getDocs(profileSetAsQuery);
                let image = '/images/transparentLogo.png';
                if (!setAsSnapshot.empty) {
                    const setAsDoc = setAsSnapshot.docs[0].data();
                    const profileImageId = setAsDoc.profileImageId;
                    if (profileImageId) {
                        const profileImageRef = doc(db, 'profileImages', profileImageId);
                        const profileImageSnap = await getDoc(profileImageRef);
                        if (profileImageSnap.exists()) {
                            image = profileImageSnap.data().imageURL || image;
                        }
                    }
                }
                organizer = { name, image };
                console.log(`[fetchEvents] Event organizer for eventId=${docSnap.id}:`, organizer);
            }

            return {
                id: docSnap.id,
                ...data,
                organizer
            } as Event;
        }));

        return events;
    } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
    }
};

export const fetchCommentsForEvent = async (eventVariantId: string) => {
    try {
        // Fetch comments for the event
        const commentsRef = collection(db, "eventVariantComments");
        const commentsQuery = query(
            commentsRef,
            where("eventVariantId", "==", eventVariantId),
            orderBy("timestamp", "desc")
        );
        const commentsSnapshot = await getDocs(commentsQuery);

        // Extract comment data and ensure userId is present
        const comments = commentsSnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            return {
                id: docSnapshot.id,
                userId: data.userId || null, // Ensure userId exists
                comment: data.comment || "",
                timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
            };
        });

        if (comments.length === 0) return [];

        // Get unique user IDs from comments
        const userIdsArray = Array.from(new Set(comments.map(c => c.userId).filter(Boolean)));

        // Fetch user data in parallel
        const userPromises = userIdsArray.map(async userId => {
            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            return userDocSnap.exists() ? { id: userId, ...userDocSnap.data() } : null;
        });

        const users = (await Promise.all(userPromises)).filter(Boolean);

        // Fetch profile images where `setAs = "profile"`
        const profileImagePromises = userIdsArray.map(async userId => {
            const profileImageSetQuery = query(
                collection(db, "profileImageSetAs"),
                where("userId", "==", userId),
                where("setAs", "==", "profile")
            );
            const profileImageSetSnapshot = await getDocs(profileImageSetQuery);

            if (!profileImageSetSnapshot.empty) {
                const profileSetAsDoc = profileImageSetSnapshot.docs[0].data();
                const profileImageId = profileSetAsDoc.profileImageId;

                if (profileImageId) {
                    const profileImageRef = doc(db, "profileImages", profileImageId);
                    const profileImageSnap = await getDoc(profileImageRef);

                    if (profileImageSnap.exists()) {
                        return { userId, profileImage: profileImageSnap.data().imageURL };
                    }
                }
            }

            return { userId, profileImage: "/images/transparentLogo.png" }; // Fallback image
        });

        const profileImages = await Promise.all(profileImagePromises);

        // Create lookup maps for users and profile images
        const userMap = Object.fromEntries(users.map(user => [user.id, user]));
        const profileImageMap = Object.fromEntries(profileImages.map(img => [img.userId, img.profileImage]));

        // Attach user data and profile image to comments
        const enrichedComments = comments.map(comment => ({
            ...comment,
            userData: userMap[comment.userId] || { firstName: "Unknown", lastName: "User", userName: "unknown" },
            profileImage: profileImageMap[comment.userId] || "/images/transparentLogo.png",
        }));

        return enrichedComments;
    } catch (error) {
        console.error("Error fetching event comments:", error);
        return [];
    }
};

/**
 * Fetch the most popular events based on attendance count
 * @param limitCount Number of events to return (default: 3)
 * @returns Promise<Event[]> Array of popular events with attendance data
 */
export const fetchMostPopularEvents = async (limitCount: number = 3): Promise<Event[]> => {
    try {
        // First, get all events
        const eventsQuery = query(
            collection(db, 'events'),
            orderBy('startDate', 'desc')
        );
        const eventsSnapshot = await getDocs(eventsQuery);

        // For each event, count the number of attendees in eventAttendees collection
        const eventsWithAttendance: Array<Event & { attendees: number }> = await Promise.all(
            eventsSnapshot.docs.map(async (docSnap) => {
                const eventData = docSnap.data() as Omit<Event, 'id'>;
                const eventId = docSnap.id;
                // Query eventAttendees where eventId matches
                const attendeesQuery = query(
                    collection(db, 'eventAttendees'),
                    where('eventId', '==', eventId)
                );
                const attendeesSnapshot = await getDocs(attendeesQuery);
                const attendees = attendeesSnapshot.size;
                return {
                    id: eventId,
                    ...eventData,
                    attendees
                } as Event & { attendees: number };
            })
        );

        // Sort by attendance (most popular first) and limit results
        const popularEvents = eventsWithAttendance
            .sort((a, b) => b.attendees - a.attendees)
            .slice(0, limitCount);

        return popularEvents;
    } catch (error) {
        console.error('Error fetching popular events:', error);
        throw error;
    }
};