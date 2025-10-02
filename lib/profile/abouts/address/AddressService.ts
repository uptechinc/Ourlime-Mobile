import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { Address, AddressFormData } from '@/types/addressTypes';

export class AddressService {
    private static instance: AddressService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): AddressService {
        if (!AddressService.instance) {
            AddressService.instance = new AddressService();
        }
        return AddressService.instance;
    }

    async getAddresses(userId: string) {
        const addressesQuery = query(
            collection(this.db, 'addresses'),
            where('userId', '==', userId)
        );

        const addressesSnapshot = await getDocs(addressesQuery);
        const addressesData = addressesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const addressesWithSettings = await Promise.all(
            addressesData.map(async (address) => {
                const setAsQuery = query(
                    collection(this.db, 'addressSetAs'),
                    where('addressId', '==', address.id)
                );
                const setAsSnapshot = await getDocs(setAsQuery);

                return {
                    ...address,
                    settings: setAsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                };
            })
        );

        return addressesWithSettings;
    }

    async addAddress(addressData: AddressFormData, userId: string) {
        const addressRef = await addDoc(collection(this.db, 'addresses'), {
            ...addressData,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        // Add initial type if provided
        if (addressData.type) {
            await this.addAddressType(addressRef.id, addressData.type);
        }

        return addressRef.id;
    }

    async updateAddress(addressId: string, data: Partial<AddressFormData>) {
        const addressRef = doc(this.db, 'addresses', addressId);
        await updateDoc(addressRef, {
            ...data,
            updatedAt: Timestamp.now()
        });
    }

    async deleteAddress(addressId: string) {
        // Delete all associated types first
        const setAsQuery = query(
            collection(this.db, 'addressSetAs'),
            where('addressId', '==', addressId)
        );
        const setAsSnapshot = await getDocs(setAsQuery);
        await Promise.all(
            setAsSnapshot.docs.map(doc => deleteDoc(doc.ref))
        );

        // Delete the address
        await deleteDoc(doc(this.db, 'addresses', addressId));
    }

    async addAddressType(addressId: string, setAs: string) {
        const typeRef = await addDoc(collection(this.db, 'addressSetAs'), {
            addressId,
            setAs,
            createdAt: Timestamp.now()
        });
        return typeRef.id;
    }

    async deleteAddressType(typeId: string) {
        await deleteDoc(doc(this.db, 'addressSetAs', typeId));
    }

    async getAddressTypes(addressId: string) {
        const setAsQuery = query(
            collection(this.db, 'addressSetAs'),
            where('addressId', '==', addressId)
        );
        const snapshot = await getDocs(setAsQuery);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }
}

export const addressService = AddressService.getInstance();
