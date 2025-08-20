import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
// import { storage } from '@/lib/firebaseConfig';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PostHeader } from './components/Header/PostHeader';
import { Description } from './components/Content/Description/Description';
import { Poll } from './components/Content/Poll/Poll';
import { MediaUpload } from './components/Content/MediaUpload/MediaUpload';
import { Hashtags } from './components/Content/Hashtags/Hashtags';
import { PostFooter } from './components/Footer/PostFooter';
// import { useProfileStore } from '@/src/store/useProfileStore';
import { Caption } from './components/Content/Caption/Caption';

interface Friend {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
}

interface MediaItem {
    type: 'image' | 'video';
    typeUrl: string;
    fileName: string;
}

interface PostData {
    userId: string;
    type: 'regular' | 'poll';
    caption: string;
    description: string;
    visibility: string;
    hashtags: string[];
    mentions: string[];
    friendReferences: string[];
    media?: MediaItem[];
    pollData?: {
        options: { id: string; text: string; }[];
        duration: number;
        image: string | null;
        endTime: Date;
    };
}

interface ReelData {
    userId: string;
    type: 'reel';
    visibility: string;
    media: {
        type: 'video';
        typeUrl: string;
        fileName: string;
        duration: number;
    };
}

interface CreatePostModalProps {
    setTogglePostForm: React.Dispatch<React.SetStateAction<boolean>>;
    profilePicture: string;
    onCreatePost: () => void;
}

export default function CreatePostModal({ setTogglePostForm, profilePicture }: CreatePostModalProps) {
    // const userId = useProfileStore(state => state.id);
    const userId = 'TODO_USER_ID'; // TODO: Replace with actual user id from store

    // Post Type State
    const [postType, setPostType] = useState<'regular' | 'poll' | 'reel'>('regular');
    const [visibility, setVisibility] = useState('public');

    // Content States
    const [caption, setCaption] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMentions, setSelectedMentions] = useState<string[]>([]);

    // Media States
    const [selectedFiles, setSelectedFiles] = useState<any[]>([]); // TODO: Use react-native-image-picker or similar
    const [previews, setPreviews] = useState<string[]>([]);
    const [videoDuration, setVideoDuration] = useState<number>(0);

    // Poll States
    const [pollOptions, setPollOptions] = useState([
        { id: '1', text: '' },
        { id: '2', text: '' }
    ]);
    const [pollDuration, setPollDuration] = useState('24');
    const [pollImage, setPollImage] = useState<string | null>(null);

    // Hashtag States
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [hashtagInput, setHashtagInput] = useState('');

    // Friends List State
    const [friendsList, setFriendsList] = useState<Friend[]>([]);

    // Submit State
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // TODO: Fetch friends from API or local store for React Native
        // setFriendsList([]);
    }, [userId]);

    const handleFileSelect = (files: any[]) => {
        // TODO: Use react-native-image-picker or similar for file selection
        setSelectedFiles(prev => [...prev, ...files]);
        // setPreviews([...]); // TODO: Set previews for selected files
    };

    const handlePost = async () => {
        setIsSubmitting(true);
        try {
            // TODO: Implement post logic for React Native
            // Hash out firebase logic for now
            /*
            if (postType === 'reel') {
                // Firebase upload logic here
            } else {
                // Firebase upload logic for regular/poll
            }
            */
            setTogglePostForm(false);
        } catch (error) {
            console.error('Error in handlePost:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isPostDisabled = postType === 'reel'
        ? !selectedFiles.length
        : (!caption && !description && !selectedFiles.length &&
            (postType === 'poll' ? !pollOptions.some(opt => opt.text.trim()) : false));

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setTogglePostForm(false)}
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 16,
                }}
            >
                <View
                    style={{
                        backgroundColor: '#fff',
                        borderRadius: 24,
                        padding: 16,
                        width: '95%',
                        maxWidth: 600,
                        maxHeight: '80%',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 8,
                    }}
                >
                    <ScrollView
                        style={{ maxHeight: '100%' }}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <PostHeader
                            profilePicture={profilePicture}
                            visibility={visibility}
                            postType={postType}
                            onVisibilityChange={setVisibility}
                            onPostTypeChange={setPostType}
                            onClose={() => setTogglePostForm(false)}
                        />
                        {postType === 'reel' ? (
                            <View style={{ marginVertical: 12 }}>
                                <MediaUpload
                                    selectedFiles={selectedFiles}
                                    previews={previews}
                                    onFilesSelect={handleFileSelect}
                                    onFileRemove={(index) => {
                                        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                                        setPreviews(prev => prev.filter((_, i) => i !== index));
                                    }}
                                    isReel={true}
                                />
                                {selectedFiles.length > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, marginTop: 8 }}>
                                        <Text style={{ fontSize: 14, color: '#4b5563' }}>
                                            Video duration: {videoDuration}s
                                        </Text>
                                        {selectedFiles[0]?.fileSize !== undefined && (
                                            <Text style={{ fontSize: 14, color: '#4b5563' }}>
                                                File size: {(selectedFiles[0].fileSize / (1024 * 1024)).toFixed(2)}MB
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        ) : (
                            <>
                                <Caption
                                    caption={caption}
                                    onCaptionChange={setCaption}
                                />
                                <Description
                                    description={description}
                                    friendsList={friendsList}
                                    selectedMentions={selectedMentions}
                                    onDescriptionChange={setDescription}
                                    onMentionAdd={(userName) => setSelectedMentions(prev => [...prev, userName])}
                                    onMentionRemove={(userName) => setSelectedMentions(prev => prev.filter(m => m !== userName))}
                                />
                                {postType === 'poll' ? (
                                    <Poll
                                        pollOptions={pollOptions}
                                        pollDuration={pollDuration}
                                        pollImage={pollImage}
                                        onOptionAdd={() => setPollOptions(prev => [...prev, { id: String(prev.length + 1), text: '' }])}
                                        onOptionRemove={(id) => setPollOptions(prev => prev.filter(opt => opt.id !== id))}
                                        onOptionUpdate={(id, text) => setPollOptions(prev =>
                                            prev.map(opt => opt.id === id ? { ...opt, text } : opt)
                                        )}
                                        onDurationChange={setPollDuration}
                                        onImageUpload={(file) => {
                                            // TODO: Image upload logic for React Native
                                            // setPollImage(...)
                                        }}
                                        onImageRemove={() => setPollImage(null)}
                                    />
                                ) : (
                                    <MediaUpload
                                        selectedFiles={selectedFiles}
                                        previews={previews}
                                        onFilesSelect={handleFileSelect}
                                        onFileRemove={(index) => {
                                            setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                                            setPreviews(prev => prev.filter((_, i) => i !== index));
                                        }}
                                    />
                                )}
                                <Hashtags
                                    hashtags={hashtags}
                                    hashtagInput={hashtagInput}
                                    onHashtagInputChange={setHashtagInput}
                                    onHashtagAdd={(tag) => setHashtags(prev => [...prev, tag])}
                                    onHashtagRemove={(tag) => setHashtags(prev => prev.filter(t => t !== tag))}
                                />
                            </>
                        )}
                        <PostFooter
                            isSubmitting={isSubmitting}
                            friendsCount={friendsList.length}
                            isDisabled={isPostDisabled}
                            onEmojiClick={() => {/* TODO: Implement emoji picker */}}
                            onPost={handlePost}
                            postType={postType}
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
