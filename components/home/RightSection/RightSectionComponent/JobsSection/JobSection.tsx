import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

// Dummy data
const jobs = [
    // Professional
    {
      id: 'p1',
      basic_info: {
        type: 'professional',
        title: 'Senior React Native Engineer',
        description: 'Build high-performance mobile apps with Expo & TypeScript.',
        userId: 'u1',
        location: { type: 'remote', city: '', country: '' },
        priceRange: { from: 60, to: 80 },
        createdAt: { seconds: 1620000000 },
      },
      category: 'Development',
      category_specific: {
        name: 'Acme Corp',
        industry: 'Technology',
        size: '201-500',
        benefits: ['Health Insurance', '401k Matching'],
      },
      details: { skills: ['React Native', 'TypeScript', 'Expo'] },
    },
    // Quick Task
    {
      id: 'q1',
      basic_info: {
        type: 'quickTask',
        title: 'Logo Design',
        description: 'Design a modern logo for our fintech startup.',
        userId: 'u2',
        location: { type: 'remote', city: '', country: '' },
        priceRange: { from: 50, to: 100 },
        createdAt: { seconds: 1625000000 },
      },
      details: { skills: ['Illustrator', 'Creativity'] },
      category_specific: { urgency: 'medium', duration: '2 days', complexity: 'simple' },
    },
    // Freelance Promote
    {
      id: 'f1',
      basic_info: {
        type: 'freelancer',
        title: 'Full-Stack Developer Available',
        description: 'Experienced Node & React dev ready for your projects.',
        userId: 'u3',
        location: { type: 'remote', city: '', country: '' },
        priceRange: { from: 40, to: 40 },
        createdAt: { seconds: 1630000000 },
      },
      details: { skills: ['Node.js', 'React', 'GraphQL'] },
      category_specific: { type: 'promote', proposals: 3, timeline: 'Flexible' },
    },
    // Freelance Request
    {
      id: 'f2',
      basic_info: {
        type: 'freelancer',
        title: 'E-commerce Site Build',
        description: 'Need an e-commerce site with Next.js and Stripe.',
        userId: 'u4',
        location: { type: 'onsite', city: 'London', country: 'UK' },
        priceRange: { from: 2000, to: 5000 },
        createdAt: { seconds: 1635000000 },
      },
      details: { skills: ['Next.js', 'Stripe', 'Tailwind'] },
      category_specific: {
        type: 'request',
        proposals: 0,
        timeline: '1 month',
        deliverables: ['Setup Next.js', 'Integrate Stripe', 'Deploy to Vercel'],
      },
    },
  ];

const getJobTypeColor = (type: string) => {
  switch (type) {
    case 'professional':
      return '#3B82F6'; // Blue
    case 'quickTask':
      return '#10B981'; // Green
    case 'freelancer':
      return '#8B5CF6'; // Purple
    default:
      return '#6B7280'; // Gray
  }
};

const getJobTypeLabel = (type: string) => {
  switch (type) {
    case 'professional':
      return 'Professional';
    case 'quickTask':
      return 'Quick Task';
    case 'freelancer':
      return 'Freelance';
    default:
      return 'Job';
  }
};

const formatPrice = (priceRange: { from: number; to: number }, type: string) => {
  if (type === 'professional') {
    return `$${priceRange.from}k - $${priceRange.to}k/year`;
  }
  return `$${priceRange.from} - $${priceRange.to}`;
};

const getLocationText = (location: { type: string; city: string; country: string }) => {
  if (location.type === 'remote') {
    return 'Remote';
  }
  return location.city ? `${location.city}, ${location.country}` : location.country;
};

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
                        fontWeight: '600',
                    }}>Browse All</Text>
                </TouchableOpacity>
            </View>
            
            <View style={{
                gap: 12,
            }}>
                {jobs.slice(0, 3).map((job) => (
                    <TouchableOpacity 
                        key={job.id} 
                        style={{
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            borderRadius: 12,
                            padding: 16,
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 1,
                            },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 2,
                        }}
                        activeOpacity={0.7}
                        onPress={() => {
                            router.push('/jobs/page');
                            console.log('Navigate to job:', job.basic_info.title);
                        }}
                    >
                        <View style={{
                            marginBottom: 12,
                        }}>
                            <View style={{
                                alignSelf: 'flex-start',
                            }}>
                                <View style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 12,
                                    backgroundColor: getJobTypeColor(job.basic_info.type),
                                }}>
                                    <Text style={{
                                        color: '#FFFFFF',
                                        fontSize: 10,
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                    }}>
                                        {getJobTypeLabel(job.basic_info.type)}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={{
                            flex: 1,
                        }}>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: '#111827',
                                marginBottom: 6,
                                lineHeight: 22,
                            }} numberOfLines={2}>
                                {job.basic_info.title}
                            </Text>
                            
                            <Text style={{
                                fontSize: 14,
                                color: '#6B7280',
                                marginBottom: 12,
                                lineHeight: 20,
                            }} numberOfLines={2}>
                                {job.basic_info.description}
                            </Text>

                            <View style={{
                                gap: 8,
                            }}>
                                <View style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <Text style={{
                                        fontSize: 14,
                                        fontWeight: '600',
                                        color: '#059669',
                                    }}>
                                        {formatPrice(job.basic_info.priceRange, job.basic_info.type)}
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: '#6B7280',
                                    }}>
                                        {getLocationText(job.basic_info.location)}
                                    </Text>
                                </View>

                                {job.details.skills && (
                                    <View style={{
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        gap: 6,
                                        alignItems: 'center',
                                    }}>
                                        {job.details.skills.slice(0, 3).map((skill, index) => (
                                            <View key={index} style={{
                                                backgroundColor: '#F3F4F6',
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 6,
                                            }}>
                                                <Text style={{
                                                    fontSize: 11,
                                                    color: '#374151',
                                                    fontWeight: '500',
                                                }}>{skill}</Text>
                                            </View>
                                        ))}
                                        {job.details.skills.length > 3 && (
                                            <Text style={{
                                                fontSize: 11,
                                                color: '#6B7280',
                                                fontStyle: 'italic',
                                            }}>
                                                +{job.details.skills.length - 3} more
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {job.category_specific && (
                                    <View style={{
                                        marginTop: 4,
                                    }}>
                                        {job.category_specific.name && (
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '500',
                                                color: '#374151',
                                            }}>
                                                {job.category_specific.name}
                                            </Text>
                                        )}
                                        {job.category_specific.industry && (
                                            <Text style={{
                                                fontSize: 11,
                                                color: '#6B7280',
                                            }}>
                                                {job.category_specific.industry}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};