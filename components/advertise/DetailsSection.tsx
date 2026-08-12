import { Dispatch, SetStateAction, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { AdvertiseFormError } from '@/types/advertise';

type DetailsSectionProps = {
    error: AdvertiseFormError;
    changeForm: () => void;
    setFormState: Dispatch<SetStateAction<string>>;
};

export default function DetailsSection({
    error,
    changeForm,
    setFormState,
}: DetailsSectionProps) {
    const [isFormValid, setIsFormValid] = useState(false);
    const [isTitleTouched, setIsTitleTouched] = useState(false);
    const [isDescriptionTouched, setIsDescriptionTouched] = useState(false);
    const [isUrlTouched, setIsUrlTouched] = useState(false);
    const [isStartDateTouched, setIsStartDateTouched] = useState(false);
    const [isEndDateTouched, setIsEndDateTouched] = useState(false);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [dateErrorMessage, setDateErrorMessage] = useState<string | null>(null);
    const [campaignTitle, setCampaignTitle] = useState('');
    const [campaignDescription, setCampaignDescription] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');

    const validateDates = (): string | null => {
        if (!isStartDateTouched && !isEndDateTouched) {
            return null;
        }

        if (!startDate || !endDate) {
            return "Please select both start and end dates";
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (startDateObj.getTime() === today.getTime() || endDateObj.getTime() === today.getTime()) {
            return "Date invalid. Please choose a date that is not today";
        }

        if (startDateObj < today || endDateObj < today) {
            return "Only future dates are allowed";
        }

        if (endDateObj <= startDateObj) {
            return "End date must be after start date";
        }

        return null;
    };

    const validateWebsiteUrl = (url: string) => {
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        return urlPattern.test(url);
    };

    const validateCampaignTitle = (title: string) => {
        return title.length > 5;
    };

    const validateCampaignDescription = (description: string) => {
        return description.length > 10;
    };

    const checkFormValidity = () => {
        const titleValid = validateCampaignTitle(campaignTitle);
        const descriptionValid = validateCampaignDescription(campaignDescription);
        const urlValid = validateWebsiteUrl(websiteUrl);
        const dateError = validateDates();

        setDateErrorMessage(dateError);

        const isValid = titleValid && descriptionValid && urlValid && !dateError;
        setIsFormValid(isValid);
    };

    const saveToSessionStorage = () => {
        // TODO: Implement AsyncStorage for React Native
        // For now, we'll just proceed with the form
        console.log('Saving form data:', {
            campaignTitle,
            campaignDescription,
            startDate,
            endDate,
            websiteUrl
        });
    };

    const showDatePicker = (type: 'start' | 'end') => {
        // TODO: Implement proper date picker for React Native
        // For now, we'll use a simple alert to simulate date selection
        Alert.prompt(
            `Select ${type === 'start' ? 'Start' : 'End'} Date`,
            'Enter date in YYYY-MM-DD format:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'OK',
                    onPress: (dateString?: string) => {
                        if (dateString) {
                            if (type === 'start') {
                                setStartDate(dateString);
                                setIsStartDateTouched(true);
                            } else {
                                setEndDate(dateString);
                                setIsEndDateTouched(true);
                            }
                            checkFormValidity();
                        }
                    }
                }
            ],
            'plain-text'
        );
    };

    return (
        <ScrollView style={{ marginVertical: 4, flex: 1 }}>
            <View style={{ gap: 12, paddingHorizontal: 16 }}>

                {/* Campaign Title Input */}
                <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                        Campaign Title
                    </Text>
                    <TextInput
                        style={{
                            borderWidth: 1,
                            borderColor: isTitleTouched && !validateCampaignTitle(campaignTitle) ? '#ef4444' : '#d1d5db',
                            borderRadius: 8,
                            padding: 16,
                            fontSize: 16,
                            backgroundColor: '#ffffff'
                        }}
                        placeholder="Enter your campaign title"
                        value={campaignTitle}
                        onChangeText={(text) => {
                            setCampaignTitle(text);
                            checkFormValidity();
                            if (isTitleTouched) {
                                setIsTitleTouched(!validateCampaignTitle(text));
                            }
                        }}
                        onBlur={() => setIsTitleTouched(true)}
                    />
                    {isTitleTouched && !validateCampaignTitle(campaignTitle) && (
                        <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                            Campaign Title must be more than 5 characters.
                        </Text>
                    )}
                </View>

                {/* Campaign Description Input */}
                <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                        Campaign Description
                    </Text>
                    <TextInput
                        style={{
                            borderWidth: 1,
                            borderColor: isDescriptionTouched && !validateCampaignDescription(campaignDescription) ? '#ef4444' : '#d1d5db',
                            borderRadius: 8,
                            padding: 16,
                            fontSize: 16,
                            backgroundColor: '#ffffff',
                            height: 100,
                            textAlignVertical: 'top'
                        }}
                        placeholder="Enter your campaign description"
                        value={campaignDescription}
                        onChangeText={(text) => {
                            setCampaignDescription(text);
                            checkFormValidity();
                            if (isDescriptionTouched) {
                                setIsDescriptionTouched(!validateCampaignDescription(text));
                            }
                        }}
                        onBlur={() => setIsDescriptionTouched(true)}
                        multiline
                        numberOfLines={4}
                    />
                    {isDescriptionTouched && !validateCampaignDescription(campaignDescription) && (
                        <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                            Please enter a description for your Campaign (more than 10 characters).
                        </Text>
                    )}
                </View>

                {/* Date Selection */}
                <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                            style={{
                                flex: 1,
                                borderWidth: 1,
                                borderColor: isStartDateTouched && !startDate ? '#ef4444' : '#d1d5db',
                                borderRadius: 8,
                                padding: 16,
                                backgroundColor: '#ffffff'
                            }}
                            onPress={() => showDatePicker('start')}
                        >
                            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                                Start Date
                            </Text>
                            <Text style={{ fontSize: 16, color: startDate ? '#111827' : '#9ca3af' }}>
                                {startDate || 'Select start date'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{
                                flex: 1,
                                borderWidth: 1,
                                borderColor: isEndDateTouched && !endDate ? '#ef4444' : '#d1d5db',
                                borderRadius: 8,
                                padding: 16,
                                backgroundColor: '#ffffff'
                            }}
                            onPress={() => showDatePicker('end')}
                        >
                            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                                End Date
                            </Text>
                            <Text style={{ fontSize: 16, color: endDate ? '#111827' : '#9ca3af' }}>
                                {endDate || 'Select end date'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {dateErrorMessage && (
                        <Text style={{ color: '#ef4444', fontSize: 12 }}>{dateErrorMessage}</Text>
                    )}
                </View>

                {/* Website URL Input */}
                <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                        Website URL
                    </Text>
                    <TextInput
                        style={{
                            borderWidth: 1,
                            borderColor: isUrlTouched && !validateWebsiteUrl(websiteUrl) ? '#ef4444' : '#d1d5db',
                            borderRadius: 8,
                            padding: 16,
                            fontSize: 16,
                            backgroundColor: '#ffffff'
                        }}
                        placeholder="Enter your website URL eg. https://www.example.com"
                        value={websiteUrl}
                        onChangeText={(text) => {
                            setWebsiteUrl(text);
                            checkFormValidity();
                            if (isUrlTouched) {
                                setIsUrlTouched(!validateWebsiteUrl(text));
                            }
                        }}
                        onBlur={() => setIsUrlTouched(true)}
                        keyboardType="url"
                        autoCapitalize="none"
                    />
                    {isUrlTouched && !validateWebsiteUrl(websiteUrl) && (
                        <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                            Please enter a valid Website URL.
                        </Text>
                    )}
                </View>

                {/* Navigation Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 20 }}>
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            padding: 16,
                            borderRadius: 8,
                            backgroundColor: '#f3f4f6',
                            alignItems: 'center'
                        }}
                        onPress={() => setFormState('Media')}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151' }}>
                            Back
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            flex: 1,
                            padding: 16,
                            borderRadius: 8,
                            backgroundColor: isFormValid ? '#d1d5db' : '#e5e7eb',
                            alignItems: 'center',
                            opacity: isFormValid ? 1 : 0.6
                        }}
                        onPress={() => {
                            if (isFormValid) {
                                saveToSessionStorage();
                                changeForm();
                            }
                        }}
                        disabled={!isFormValid}
                    >
                        <Text style={{ 
                            fontSize: 16, 
                            fontWeight: '500', 
                            color: isFormValid ? '#374151' : '#9ca3af' 
                        }}>
                            Next
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}
