import { Timestamp } from "firebase/firestore";

export type AddressSetAs = {
    id: string;
    addressId: string;
    setAs: string;
}

export type Address = {
    id: string;
    Address: string;
    city: string;
    postalCode: string;
    zipCode: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    userId: string;
    settings: AddressSetAs[];
}

export type AddressFormData = {
    Address: string;
    city: string;
    postalCode: string;
    zipCode: string;
    type: string;
}
