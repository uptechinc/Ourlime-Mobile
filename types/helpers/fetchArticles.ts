import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export const fetchArticles = async (searchTerms?: string) => {
    try {
        console.log('Search Terms Received:', searchTerms);
        let articlesQuery;
        
        if (searchTerms && searchTerms !== 'All') {
            const categories = searchTerms.split(',');
            console.log('Creating filtered query for:', categories);
            articlesQuery = query(
                collection(db, 'blog'),
                where('category', 'in', categories)
            );

            
        } else {
            console.log('Creating query for all articles');
            articlesQuery = collection(db, 'blog');
        }

        const collections = await getDocs(articlesQuery);
        const collectionData = collections.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Record<string, unknown>)
        }));
        
        console.log('Query Result:', collectionData);
        return collectionData;
    } catch (error) {
        console.log('Error in fetchArticles:', error);
        return [];
    }
};
