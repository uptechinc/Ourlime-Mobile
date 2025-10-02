import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
// import { db } from '@/lib/firebaseConfig'; // TODO: Implement firebaseConfig
// import { uploadFile } from '@/helpers/firebaseStorage'; // TODO: Implement firebaseStorage
// import { ProfileData, SocialPosts, UserData } from '@/types/global'; // TODO: Implement types
// import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'; // TODO: Implement Firestore
import { AtSign, BarChart4, Earth, FileIcon, Film, Hash, ImageIcon, Lock, MapPin, Mic, Music, Smile, UserRound, Users, Video, X } from 'lucide-react-native';
// import axios from 'axios'; // TODO: Implement axios for IP/location
// import { toast, ToastContainer } from 'react-toastify'; // TODO: Implement toast notifications
// import styles from './postform.module.css';

// type PostFormProps = {
//   setTogglePostForm: React.Dispatch<SetStateAction<boolean>>;
//   setSocialPosts: React.Dispatch<SetStateAction<SocialPosts[]>>;
//   onPostCreated: () => void;
//   profile: ProfileData;
//   user: UserData;
// };

export default function PostForm(/*props: PostFormProps*/) {
  // const { setTogglePostForm, setSocialPosts, onPostCreated, profile, user } = props;
  const [togglePrivacy, setTogglePrivacy] = useState(false);
  const [toggleEmojiPicker, setToggleEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [textareaValue, setTextareaValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // const closeForm = () => {
  //   setTogglePostForm((prev: boolean) => !prev);
  //   setTogglePrivacy((prev: boolean) => !prev);
  //   setToggleEmojiPicker((prev: boolean) => !prev);
  // };

  const handleHashtagClick = () => setTextareaValue((prev) => prev + '#');
  const handleAtSignClick = () => setTextareaValue((prev) => prev + '@');

  // const handleEmojiClick = (emoji: string) => setTextareaValue((prev) => prev + emoji);

  // const getIpAddressAndLocation = async () => { /* TODO: Implement IP/location fetch */ };

  // const createSocialPost = async (event: React.FormEvent<HTMLFormElement>) => {
  //   event.preventDefault();
  //   setIsLoading(true);
  //   // TODO: Implement post creation logic with Firebase
  // };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: 'white' }}>
      {/* <ToastContainer /> */}
      <View style={{ flex: 1, padding: 0 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, borderColor: '#e5e7eb', padding: 20 }}>
          <TouchableOpacity /* onPress={closeForm} */>
            <X size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!textareaValue.trim() || isLoading}
            style={{ backgroundColor: (!textareaValue.trim() || isLoading) ? '#d1d5db' : '#6366f1', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 }}
            /* onPress={createSocialPost} */
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: 'white', fontWeight: 'bold' }}>Share</Text>}
          </TouchableOpacity>
        </View>
        {/* Textarea */}
        <TextInput
          value={textareaValue}
          onChangeText={setTextareaValue}
          placeholder="What's happening?"
          multiline
          style={{ minHeight: 120, width: '100%', padding: 12, fontSize: 16, borderWidth: 0, textAlignVertical: 'top' }}
        />
        {/* Privacy and shortcuts */}
        <View style={{ borderBottomWidth: 2, borderColor: '#e5e7eb', paddingBottom: 12, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <TouchableOpacity onPress={() => setTogglePrivacy((prev) => !prev)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Earth size={20} />
              <Text style={{ marginLeft: 4 }}>Everyone</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={handleHashtagClick}><Hash size={20} /></TouchableOpacity>
              <TouchableOpacity onPress={handleAtSignClick}><AtSign size={20} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setToggleEmojiPicker((prev) => !prev)}><Smile size={20} /></TouchableOpacity>
            </View>
          </View>
          {/* Privacy dropdown (placeholder) */}
          {togglePrivacy && (
            <View style={{ position: 'absolute', top: -120, left: 0, width: 180, backgroundColor: 'black', borderRadius: 8, padding: 12, zIndex: 10 }}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><Lock color="white" size={18} /><Text style={{ color: 'white', marginLeft: 8 }}>Only Me</Text></TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><Earth color="white" size={18} /><Text style={{ color: 'white', marginLeft: 8 }}>Everyone</Text></TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><UserRound color="white" size={18} /><Text style={{ color: 'white', marginLeft: 8 }}>People I follow</Text></TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}><Users color="white" size={18} /><Text style={{ color: 'white', marginLeft: 8 }}>People Follow Me</Text></TouchableOpacity>
            </View>
          )}
        </View>
        {/* Image/Video Preview */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 12 }}>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage.uri || selectedImage }}
              style={{ width: 120, height: 120, borderRadius: 8, marginRight: 8, resizeMode: 'contain' }}
            />
          )}
          {selectedVideo && (
            <View style={{ width: 120, height: 120, backgroundColor: '#00000022', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#888' }}>[Video preview here]</Text>
            </View>
          )}
        </View>
        {/* Icons */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, paddingVertical: 12 }}>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <ImageIcon size={28} />
            <Text style={{ fontSize: 12 }}>Upload Images</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <Video size={28} />
            <Text style={{ fontSize: 12 }}>Upload Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <Film size={28} />
            <Text style={{ fontSize: 12 }}>Upload Reels</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <Mic size={28} />
            <Text style={{ fontSize: 12 }}>Record Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <FileIcon size={28} />
            <Text style={{ fontSize: 12 }}>Upload File</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <BarChart4 size={28} />
            <Text style={{ fontSize: 12 }}>Create Poll</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <MapPin size={28} />
            <Text style={{ fontSize: 12 }}>Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', margin: 8 }}>
            <Music size={28} />
            <Text style={{ fontSize: 12 }}>Upload Audio</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
