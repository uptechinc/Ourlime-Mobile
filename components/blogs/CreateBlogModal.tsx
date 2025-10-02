import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    Modal, 
    ScrollView, 
    Alert,
    ActivityIndicator,
    Dimensions
} from 'react-native';
// TODO: Comment out Firebase setup for later implementation
// import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';

interface CreateBlogModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onSuccess?: () => void;
}

export default function CreateBlogModal({ isOpen, onClose, userId, onSuccess }: CreateBlogModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        type: 'blog' as 'blog' | 'article',
        excerpt: '',
        content: '',
        coverImage: '',
        categoryId: '',
        readTime: 0,
        tags: [] as string[],
        sources: [] as Array<{
            title: string;
            url: string;
            author: string;
            publishDate: Date;
            type: string;
            citation: string;
            isVerified: boolean;
        }>
    });

    const screenHeight = Dimensions.get('window').height;

    const handleSubmit = async () => {
        if (!formData.title.trim() || !formData.excerpt.trim() || !formData.content.trim()) {
            Alert.alert('Error', 'Please fill in all required fields.');
            return;
        }

        setIsLoading(true);

        try {
            // TODO: Replace with actual API call when Firebase is implemented
            // const response = await fetch('/api/blogs&articles', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({
            //         userId,
            //         ...formData
            //     }),
            // });

            // if (!response.ok) {
            //     throw new Error('Failed to create blog');
            // }

            // const result = await response.json();
            
            // if (result.status === 'success') {
            //     onSuccess?.();
            //     onClose();
            // } else {
            //     throw new Error(result.message || 'Failed to create blog');
            // }

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            Alert.alert(
                'Success!', 
                'Blog created successfully!',
                [{ text: 'OK', onPress: () => {
                    onSuccess?.();
                    onClose();
                }}]
            );

        } catch (error) {
            console.error('Error creating blog:', error);
            Alert.alert('Error', 'Failed to create blog. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field: string, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const showTypeSelection = () => {
        Alert.alert(
            'Select Type',
            'Choose the type of content you want to create',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Blog', onPress: () => handleInputChange('type', 'blog') },
                { text: 'Article', onPress: () => handleInputChange('type', 'article') }
            ]
        );
    };

    const showCategorySelection = () => {
        Alert.alert(
            'Select Category',
            'Choose a category for your content',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Technology', onPress: () => handleInputChange('categoryId', 'technology') },
                { text: 'Lifestyle', onPress: () => handleInputChange('categoryId', 'lifestyle') },
                { text: 'Business', onPress: () => handleInputChange('categoryId', 'business') },
                { text: 'Health', onPress: () => handleInputChange('categoryId', 'health') },
                { text: 'Education', onPress: () => handleInputChange('categoryId', 'education') }
            ]
        );
    };

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={{ 
                flex: 1, 
                backgroundColor: '#ffffff' 
            }}>
                {/* Header */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                    backgroundColor: '#ffffff'
                }}>
                    <Text style={{
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: '#111827'
                    }}>
                        Create New Blog
                    </Text>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            padding: 8,
                            borderRadius: 20
                        }}
                    >
                        <Text style={{ fontSize: 20, color: '#6b7280' }}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Form Content */}
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ gap: 16 }}>
                        {/* Title */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Title *
                            </Text>
                            <TextInput
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    padding: 12,
                                    fontSize: 16,
                                    backgroundColor: '#ffffff'
                                }}
                                placeholder="Enter your blog title"
                                value={formData.title}
                                onChangeText={(text) => handleInputChange('title', text)}
                            />
                        </View>

                        {/* Type Selection */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Type *
                            </Text>
                            <TouchableOpacity
                                onPress={showTypeSelection}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    padding: 12,
                                    backgroundColor: '#ffffff',
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{
                                    fontSize: 16,
                                    color: formData.type ? '#111827' : '#9ca3af'
                                }}>
                                    {formData.type || 'Select blog type'}
                                </Text>
                                <Text style={{ fontSize: 16, color: '#9ca3af' }}>▼</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Excerpt */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Excerpt *
                            </Text>
                            <TextInput
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    padding: 12,
                                    fontSize: 16,
                                    backgroundColor: '#ffffff',
                                    height: 80,
                                    textAlignVertical: 'top'
                                }}
                                placeholder="Write a brief summary of your blog"
                                value={formData.excerpt}
                                onChangeText={(text) => handleInputChange('excerpt', text)}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Content */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Content *
                            </Text>
                            <TextInput
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    padding: 12,
                                    fontSize: 16,
                                    backgroundColor: '#ffffff',
                                    height: 200,
                                    textAlignVertical: 'top'
                                }}
                                placeholder="Write your blog content here"
                                value={formData.content}
                                onChangeText={(text) => handleInputChange('content', text)}
                                multiline
                                numberOfLines={10}
                            />
                        </View>

                        {/* Cover Image */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Cover Image URL
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TextInput
                                    style={{
                                        flex: 1,
                                        borderWidth: 1,
                                        borderColor: '#d1d5db',
                                        borderRadius: 8,
                                        padding: 12,
                                        fontSize: 16,
                                        backgroundColor: '#ffffff'
                                    }}
                                    placeholder="Enter image URL"
                                    value={formData.coverImage}
                                    onChangeText={(text) => handleInputChange('coverImage', text)}
                                />
                                <TouchableOpacity
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        backgroundColor: '#3b82f6',
                                        borderRadius: 8,
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                    onPress={() => Alert.alert('Upload', 'Image upload functionality coming soon!')}
                                >
                                    <Text style={{ color: '#ffffff', fontWeight: '500' }}>
                                        Upload
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Category */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Category *
                            </Text>
                            <TouchableOpacity
                                onPress={showCategorySelection}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    padding: 12,
                                    backgroundColor: '#ffffff',
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{
                                    fontSize: 16,
                                    color: formData.categoryId ? '#111827' : '#9ca3af'
                                }}>
                                    {formData.categoryId || 'Select a category'}
                                </Text>
                                <Text style={{ fontSize: 16, color: '#9ca3af' }}>▼</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Read Time */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Read Time (minutes) *
                            </Text>
                            <TextInput
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    padding: 12,
                                    fontSize: 16,
                                    backgroundColor: '#ffffff'
                                }}
                                placeholder="Estimated read time"
                                value={formData.readTime.toString()}
                                onChangeText={(text) => handleInputChange('readTime', parseInt(text) || 0)}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Tags */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 8,
                                color: '#374151'
                            }}>
                                Tags
                            </Text>
                            <TextInput
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    padding: 12,
                                    fontSize: 16,
                                    backgroundColor: '#ffffff'
                                }}
                                placeholder="Add tags (comma separated)"
                                onChangeText={(text) => {
                                    const tags = text.split(',').map(tag => tag.trim());
                                    setFormData(prev => ({ ...prev, tags }));
                                }}
                            />
                        </View>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={{
                    flexDirection: 'row',
                    gap: 12,
                    padding: 16,
                    borderTopWidth: 1,
                    borderTopColor: '#e5e7eb',
                    backgroundColor: '#ffffff'
                }}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            borderWidth: 1,
                            borderColor: '#d1d5db',
                            borderRadius: 8,
                            alignItems: 'center'
                        }}
                    >
                        <Text style={{ fontSize: 16, color: '#374151' }}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            backgroundColor: '#10b981',
                            borderRadius: 8,
                            alignItems: 'center',
                            opacity: isLoading ? 0.6 : 1
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={{ 
                                fontSize: 16, 
                                color: '#ffffff', 
                                fontWeight: '500' 
                            }}>
                                Create Blog
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}