import { StaticImageData } from "next/image";

export type Articles = {
  id: string;
  title: string;
  image: string;
  date: { seconds: number; nanoseconds: number };
  author: string;
  category: string;
};

export type Categories = {
  id: string;
  name: string;
};



export type Metadata = {
  metadataBase: string;
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    url: string;
    title: string;
    description: string;
    images: {
      url: string;
      width: number;
      height: number;
      alt: string; 
    }[];
    site_name: string;
  }
}

export type RootLayoutProps = {
  children: ReactElement;
  hideButton?: boolean;
}

export type Data = {
  month: string;
  users: number;
  posts: number;
  pages: number;
  groups: number;
  [key: string]: string | number; // Allow dynamic property access
}

export type SocialPosts = {
  uid?: string;
  username: string;
  email: string;
  profileImage: StaticImageData | string;
  postImage?: StaticImageData | string;
  type: {
    image: string;
    video: string;
  };
  video?: string;
  content: string;
  likes?: number;
  comments?: string;
  time:Firebase.Timestamp; 
//TODO change to Date.now or something similar
}

export type Stories = {
  id: string;
  username: string;
  description?: string;
  file: string;
  profilePicture: string;
} 

export type Product = {
  id: number;
  name: string;
  description: string;
  price: string;
  type: string;
  category: string;
  stock: number;
  imageUrl: StaticImageData;
}

export type Job = {
  id: string;
  title: string;
  description: string;
  type: string;
  imageUrl: StaticImageData;
}

export type ProfileData = {
  firstName: string;
  lastName: string;
  banner: string;
  email: string;
  country: string;
  phone: string;
  aboutMe: string;
  likes: number;
  posts: number;
  following: number
  followers: number;
  birthday: Date | Firebase.Timestamp;
  school: string;
  workingAt: string;
  followerCount: number;
  followingCount: number;
}

export type UserData = {
	email: string;
	friends: string[];
	gender: string;
  isAdmin: boolean;
  last_loggedIn: Firebase.Timestamp;
  userName: string;
  photoURL: string;
};

export type Communities = {
  id: string;
  name: string;
  communityImage: StaticImageData | string;
  memberCount: number; // Renamed members to memberCount to hold the number of members
  members: string[]; // New field for storing the members' IDs or names
  category: string;
  isPublic: boolean;
  posts: SocialPostsData[];
}

export type Follower = {
  uid: string;
  username: string;
  profilePicture: string;
  email: string;
};

export type Following = {
  uid: string;
  username: string;
  profilePicture: string;
  email: string;
};

// export type Following = {
//   followerId: string;
//   followeeId: string;
//   createdAt: Date;
//   updatedAt: Date;
// }

// export type UserData = {
// 	id: string;
// 	firstName: string;
// 	lastName: string;
// 	userName: string;
// 	email: string;
// 	gender: string;
// 	birthday: string;
// 	country: string;
// 	isAdmin: boolean;
// 	last_loggedIn: Date;
// 	userTier: number;
// 	createdAt: Date;
// }

export type ProfileImage = {
	id: string;
	imageURL: string;
	userId: string;
	typeOfImage: string;
	createdAt: Date;
	updatedAt: Date;
}

export type SearchUser = {
	id: string;
	userName: string;
	firstName: string;
	lastName: string;
	profileImage?: string;
}

export type Post = {
	id: string;
	caption: string;
	description: string;
	visibility: string;
	createdAt: Date;
	userId: string;
	hashtags: Array<string>;
	media: string;
	userReferences: Array<string>;
	user: {
		firstName: string;
		lastName: string;
		userName: string;
		profileImage?: string;
	};
}

export type PostData = {
	userId: string;
	caption: string;
	description: string;
	createdAt: Date;
	visibility: string;
}


export type User = {
    username: ReactNode;
	id: string;
	firstName: string;
	lastName: string;
	userName: string;
	profileImage?: string;
}

export type Comment = {
  id: string;
  comment: string;
  createdAt: Date;
  // updatedAt: Date;
  feedsPostId: string;
  userId: string;
  replies: Comment[];
  userData: {
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
  };
};

export type Reply = {
  id: string;
  reply: string;
  feedsPostCommentId: string;
  // feedsPostCommentReplyId: string;
  userId: string;
  createdAt: Date;
  userData: {
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
  };

};