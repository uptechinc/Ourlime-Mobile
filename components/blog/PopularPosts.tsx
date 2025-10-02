import React from 'react';
import { View, Text, Image, ScrollView } from 'react-native';

type PopularPostsProps = {
	posts: Array<{
		uri: string;
		title?: string;
		author?: string;
	}>;
};

export default function PopularPosts({ posts }: PopularPostsProps) {
	return (
		<View style={{
			borderRadius: 8,
			backgroundColor: '#ffffff',
			padding: 16,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.1,
			shadowRadius: 4,
			elevation: 3
		}}>
			{/* Header */}
			<View style={{
				flexDirection: 'row',
				alignItems: 'center',
				borderBottomWidth: 1,
				borderBottomColor: '#e5e7eb',
				paddingBottom: 8
			}}>
				<Text style={{
					marginRight: 8,
					fontSize: 20,
					color: '#ef4444'
				}}>
					⭐
				</Text>
				<Text style={{
					fontSize: 20,
					fontWeight: '600',
					color: '#111827'
				}}>
					Popular posts
				</Text>
			</View>

			{/* Divider */}
			<View style={{
				height: 1,
				backgroundColor: '#e5e7eb',
				marginVertical: 16
			}} />

			{/* Posts List */}
			<ScrollView showsVerticalScrollIndicator={false}>
				<View style={{ gap: 16 }}>
					{posts.map((post, index) => (
						<View key={index} style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 16
						}}>
							{/* Post Thumbnail */}
							<View style={{
								height: 80,
								width: 80,
								borderRadius: 8,
								overflow: 'hidden'
							}}>
								<Image
									source={{ uri: post.uri }}
									style={{
										width: '100%',
										height: '100%',
										resizeMode: 'cover'
									}}
								/>
							</View>

							{/* Post Content */}
							<View style={{ flex: 1 }}>
								<Text style={{
									fontWeight: '600',
									fontSize: 14,
									color: '#111827',
									marginBottom: 4,
									lineHeight: 20
								}}>
									{post.title || 'Particle Size Analysis Market worth $596 million by 2028'}
								</Text>
								<View style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 4
								}}>
									<Text style={{
										fontSize: 12,
										color: '#9ca3af'
									}}>
										By
									</Text>
									<Text style={{
										fontSize: 12,
										color: '#6b7280'
									}}>
										{post.author || 'P N'}
									</Text>
									<Text style={{
										fontSize: 12,
										color: '#6b7280'
									}}>
										·
									</Text>
								</View>
							</View>
						</View>
					))}
				</View>
			</ScrollView>
		</View>
	);
}
