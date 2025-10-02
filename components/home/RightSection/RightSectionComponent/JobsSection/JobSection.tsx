import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

const jobs = [
    { role: 'Senior Developer', company: 'TechCorp', location: 'Remote', image: 'https://picsum.photos/200/200?random=8' },
    { role: 'UX Designer', company: 'DesignLabs', location: 'New York', image: 'https://picsum.photos/200/200?random=9' },
    { role: 'Product Manager', company: 'StartupX', location: 'San Francisco', image: 'https://picsum.photos/200/200?random=10' }
];

export const JobsSection = () => {
    const router = useRouter();

    return (
        <View style={{
            marginBottom: 32,
            paddingHorizontal: 16,
        }}>
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
            }}>
                <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#000',
                }}>Featured Jobs</Text>
                <TouchableOpacity onPress={() => router.push('/jobs/page')}>
                    <Text style={{
                        fontSize: 14,
                        color: '#22c55e',
                    }}>Browse All</Text>
                </TouchableOpacity>
            </View>
            <View style={{
                gap: 16,
            }}>
                {jobs.map((job, index) => (
                    <TouchableOpacity 
                        key={index} 
                        style={{
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderRadius: 8,
                            padding: 12,
                        }}
                        activeOpacity={0.7}
                        onPress={() => {
                            // Navigate to job details
                            router.push('/jobs/page');
                            console.log('Navigate to job:', job.role);
                        }}
                    >
                        <View style={{
                            flexDirection: 'row',
                            gap: 12,
                            alignItems: 'center',
                        }}>
                            <Image
                                source={{ uri: job.image }}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 8,
                                }}
                                resizeMode="cover"
                            />
                            <View style={{
                                flex: 1,
                            }}>
                                <Text style={{
                                    fontWeight: '500',
                                    fontSize: 14,
                                    color: '#000',
                                    marginBottom: 2,
                                }}>{job.role}</Text>
                                <Text style={{
                                    color: '#6b7280',
                                    fontSize: 12,
                                    marginBottom: 2,
                                }}>{job.company}</Text>
                                <Text style={{
                                    color: '#9ca3af',
                                    fontSize: 12,
                                }}>{job.location}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};
