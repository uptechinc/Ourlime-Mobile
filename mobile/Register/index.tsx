import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  SafeAreaView,
  Image,
  Modal,
  Alert,
  Dimensions,
  PixelRatio,
} from 'react-native';
import { styles } from './styles';
import { mockData } from './data.mock';

// Responsive breakpoints
const TABLET_MIN = 768;
const LARGE_TABLET_MIN = 1024;

// Get device dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive tokens
const isTablet = screenWidth >= TABLET_MIN;
const isLargeTablet = screenWidth >= LARGE_TABLET_MIN;
const fontScale = Math.min(PixelRatio.getFontScale(), isTablet ? 1.2 : 1.0);
const contentMaxWidth = isLargeTablet ? 800 : isTablet ? 600 : screenWidth;

// Types
type FormData = {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  gender: string;
  birthday: string;
  password: string;
  confirmPassword: string;
  country: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
  zipCode: string;
  profilePicture: string | null;
  selectedInterests: string[];
};

type AvatarType = 'cartoon' | 'realistic';

const Register: React.FC = () => {
  // State management
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(mockData.formData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<AvatarType>('cartoon');
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false);

  // File refs (stubbed for mobile)
  // const idFaceRef = useRef<any>(null);
  // const idFrontRef = useRef<any>(null);
  // const idBackRef = useRef<any>(null);

  // Validation functions (stubbed)
  // const validateStep1 = (): boolean => {
  //   console.log('TODO: Validate step 1');
  //   return true;
  // };

  // const validateStep3 = (): boolean => {
  //   console.log('TODO: Validate step 3');
  //   return true;
  // };

  // Event handlers (stubbed)
  const handleNextStep = () => {
    console.log('TODO: Navigate to next step');
    if (step < 6) {
      setStep(step + 1);
    }
  };

  const handlePreviousStep = () => {
    console.log('TODO: Navigate to previous step');
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    console.log('TODO: Submit registration form');
    setIsSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert('Success', 'Registration completed!');
    }, 2000);
  };

  const handleAvatarSelection = (avatar: string) => {
    console.log('TODO: Select avatar', avatar);
    setFormData({ ...formData, profilePicture: avatar });
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return renderStep1();
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>
          Welcome to <Text style={styles.greenText}>Ourlime</Text>
        </Text>
        <Text style={[styles.subtitle, { fontSize: 16 * fontScale }]}>
          Create your new account
        </Text>
        <Pressable onPress={() => console.log('TODO: Navigate to login')}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.greenText}>Sign In</Text>
          </Text>
        </Pressable>
      </View>

      <View style={styles.formContainer}>
        {/* Name fields */}
        <View style={isTablet ? styles.rowContainer : styles.columnContainer}>
          <View style={[styles.inputContainer, isTablet ? { flex: 1 } : {}]}>
            <TextInput
              style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
              placeholder="First Name"
              value={formData.firstName}
              onChangeText={(value: string) => handleInputChange('firstName', value)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
          </View>
          <View style={[styles.inputContainer, isTablet ? { flex: 1 } : {}]}>
            <TextInput
              style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
              placeholder="Last Name"
              value={formData.lastName}
              onChangeText={(value: string) => handleInputChange('lastName', value)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
          </View>
        </View>

        {/* Username */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
            placeholder="Username"
            value={formData.userName}
            onChangeText={(value: string) => handleInputChange('userName', value)}
            autoCapitalize="none"
            returnKeyType="next"
          />
          {errors.userName && <Text style={styles.errorText}>{errors.userName}</Text>}
        </View>

        {/* Email */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
            placeholder="Email Address"
            value={formData.email}
            onChangeText={(value: string) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        {/* Gender */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
            placeholder="Gender (Male/Female/Other)"
            value={formData.gender}
            onChangeText={(value: string) => handleInputChange('gender', value)}
            returnKeyType="next"
          />
          {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
        </View>

        {/* Birthday */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
            placeholder="Date of Birth (MM/DD/YYYY)"
            value={formData.birthday}
            onChangeText={(value: string) => handleInputChange('birthday', value)}
            returnKeyType="next"
          />
          {errors.birthday && <Text style={styles.errorText}>{errors.birthday}</Text>}
        </View>

        {/* Password fields */}
        <View style={isTablet ? styles.rowContainer : styles.columnContainer}>
          <View style={[styles.inputContainer, isTablet ? { flex: 1 } : {}]}>
            <TextInput
              style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
              placeholder="Password"
              value={formData.password}
              onChangeText={(value: string) => handleInputChange('password', value)}
              secureTextEntry
              returnKeyType="next"
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>
          <View style={[styles.inputContainer, isTablet ? { flex: 1 } : {}]}>
            <TextInput
              style={[styles.input, { fontSize: isTablet ? 18 : 16 }]}
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(value: string) => handleInputChange('confirmPassword', value)}
              secureTextEntry
              returnKeyType="done"
            />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>
        </View>

        {/* Terms and Privacy */}
        <View style={styles.checkboxContainer}>
          <Pressable
            style={styles.checkboxRow}
            onPress={() => setIsTermsAccepted(!isTermsAccepted)}
          >
            <View style={[styles.checkbox, isTermsAccepted && styles.checkboxSelected]}>
              {isTermsAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxText}>
              I accept Ourlime{' '}
              <Text style={styles.greenText} onPress={() => setIsTermsOpen(true)}>
                Terms and Conditions
              </Text>
            </Text>
          </Pressable>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setIsPrivacyAccepted(!isPrivacyAccepted)}
          >
            <View style={[styles.checkbox, isPrivacyAccepted && styles.checkboxSelected]}>
              {isPrivacyAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxText}>
              I accept Ourlime{' '}
              <Text style={styles.greenText} onPress={() => setIsPrivacyOpen(true)}>
                Privacy Policy
              </Text>
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={[
          styles.button,
          styles.primaryButton,
          (!isTermsAccepted || !isPrivacyAccepted) && styles.buttonDisabled,
        ]}
        onPress={handleNextStep}
        disabled={!isTermsAccepted || !isPrivacyAccepted}
      >
        <Text style={[styles.buttonText, styles.primaryButtonText]}>Next Step</Text>
      </Pressable>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>Select your avatar</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'cartoon' && styles.activeTab]}
          onPress={() => setActiveTab('cartoon')}
        >
          <Text style={[styles.tabText, activeTab === 'cartoon' && styles.activeTabText]}>
            Cartoon
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'realistic' && styles.activeTab]}
          onPress={() => setActiveTab('realistic')}
        >
          <Text style={[styles.tabText, activeTab === 'realistic' && styles.activeTabText]}>
            Realistic
          </Text>
        </Pressable>
      </View>

      {/* Avatar Grid */}
      <View style={styles.avatarGrid}>
        {activeTab === 'cartoon' ? (
          <View style={isTablet ? styles.avatarRow : styles.avatarColumn}>
            {mockData.cartoonAvatars.map((avatar: any) => (
              <Pressable
                key={avatar.id}
                style={styles.avatarItem}
                onPress={() => handleAvatarSelection(avatar.id)}
              >
                <Image source={avatar.image} style={styles.avatarImage} />
                {formData.profilePicture === avatar.id && (
                  <View style={styles.checkOverlay}>
                    <Image source={mockData.checkIcon} style={styles.checkIcon} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={isTablet ? styles.avatarRow : styles.avatarColumn}>
            {mockData.realisticAvatars.map((avatar: any) => (
              <Pressable
                key={avatar.id}
                style={styles.avatarItem}
                onPress={() => handleAvatarSelection(avatar.id)}
              >
                <Image source={avatar.image} style={styles.avatarImage} />
                {formData.profilePicture === avatar.id && (
                  <View style={styles.checkOverlay}>
                    <Image source={mockData.checkIcon} style={styles.checkIcon} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable onPress={() => console.log('TODO: Navigate to custom image upload')}>
        <Text style={styles.linkText}>Use your own picture</Text>
      </Pressable>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={handlePreviousStep}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Previous Step</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primaryButton, !formData.profilePicture && styles.buttonDisabled]}
          onPress={handleNextStep}
          disabled={!formData.profilePicture}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>Next Step!</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>Tell us about your location</Text>
      </View>

      <View style={styles.formContainer}>
        {/* Phone */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={[styles.input, { fontSize: 16 * fontScale }]}
            placeholder="Enter your phone number"
            value={formData.phone}
            onChangeText={(value: string) => handleInputChange('phone', value)}
            keyboardType="phone-pad"
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        {/* Country */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Country *</Text>
          <TextInput
            style={[styles.input, { fontSize: 16 * fontScale }]}
            placeholder="Select your country"
            value={formData.country}
            onChangeText={(value: string) => handleInputChange('country', value)}
          />
          {errors.country && <Text style={styles.errorText}>{errors.country}</Text>}
        </View>

        {/* Optional fields */}
        <View style={isTablet ? styles.rowContainer : styles.columnContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={[styles.input, { fontSize: 16 * fontScale }]}
              placeholder="Enter your city"
              value={formData.city}
              onChangeText={(value: string) => handleInputChange('city', value)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Region</Text>
            <TextInput
              style={[styles.input, { fontSize: 16 * fontScale }]}
              placeholder="Enter your region"
              value={formData.address}
              onChangeText={(value: string) => handleInputChange('address', value)}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, { fontSize: 16 * fontScale }]}
            placeholder="Enter your address"
            value={formData.address}
            onChangeText={(value: string) => handleInputChange('address', value)}
          />
        </View>

        <View style={isTablet ? styles.rowContainer : styles.columnContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Zip Code</Text>
            <TextInput
              style={[styles.input, { fontSize: 16 * fontScale }]}
              placeholder="Enter zip code"
              value={formData.zipCode}
              onChangeText={(value: string) => handleInputChange('zipCode', value)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Postal Code</Text>
            <TextInput
              style={[styles.input, { fontSize: 16 * fontScale }]}
              placeholder="Enter postal code"
              value={formData.postalCode}
              onChangeText={(value: string) => handleInputChange('postalCode', value)}
            />
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={handlePreviousStep}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Previous Step</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={handleNextStep}>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>Next Step</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>Interests & Verification</Text>
        <Text style={[styles.subtitle, { fontSize: 16 * fontScale }]}>
          Tell us about your interests
        </Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Select your interests (optional)</Text>
        <View style={styles.interestsGrid}>
          {mockData.interests.map((interest: string) => (
            <Pressable
              key={interest}
              style={[
                styles.interestChip,
                formData.selectedInterests.includes(interest) && styles.interestChipSelected,
              ]}
                onPress={() => {
                  const newInterests = formData.selectedInterests.includes(interest)
                    ? formData.selectedInterests.filter((i: string) => i !== interest)
                    : [...formData.selectedInterests, interest];
                  setFormData({ ...formData, selectedInterests: newInterests });
                }}
            >
              <Text
                style={[
                  styles.interestChipText,
                  formData.selectedInterests.includes(interest) && styles.interestChipTextSelected,
                ]}
              >
                {interest}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={handlePreviousStep}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Previous Step</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={handleNextStep}>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>Next Step</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>Authentication</Text>
        <Text style={[styles.subtitle, { fontSize: 16 * fontScale }]}>
          Complete your registration
        </Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.infoText}>
          Your account will be created and you'll receive a verification email.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={handlePreviousStep}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Previous Step</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>Identity Verification</Text>
        <Text style={[styles.subtitle, { fontSize: 16 * fontScale }]}>
          Upload your ID documents for verification
        </Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.infoText}>
          This step is required for account verification. Your documents will be securely processed.
        </Text>

        {/* File upload placeholders */}
        <View style={styles.uploadContainer}>
          <Pressable style={styles.uploadButton}>
            <Text style={styles.uploadText}>Upload Face Photo</Text>
          </Pressable>
          <Pressable style={styles.uploadButton}>
            <Text style={styles.uploadText}>Upload ID Front</Text>
          </Pressable>
          <Pressable style={styles.uploadButton}>
            <Text style={styles.uploadText}>Upload ID Back</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={handlePreviousStep}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Previous Step</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSubmit}>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>Complete Registration</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.contentContainer, { maxWidth: contentMaxWidth, alignSelf: 'center' }]}>
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${(step / 6) * 100}%` }]}>
              <View style={styles.progressLogo}>
                <Text style={styles.progressLogoText}>O</Text>
              </View>
            </View>
          </View>

          {/* Step Content */}
          <View style={styles.stepContent}>
            {renderStepContent()}
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <Modal visible={isTermsOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable 
              style={styles.modalCloseButton} 
              onPress={() => setIsTermsOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseButtonText}>×</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Terms and Conditions</Text>
            <ScrollView 
              style={{ flex: 1 }} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              <Text style={styles.modalText}>{mockData.termsText}</Text>
            </ScrollView>
            <Pressable 
              style={styles.modalButton} 
              onPress={() => setIsTermsOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={isPrivacyOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable 
              style={styles.modalCloseButton} 
              onPress={() => setIsPrivacyOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseButtonText}>×</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Privacy Policy</Text>
            <ScrollView 
              style={{ flex: 1 }} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              <Text style={styles.modalText}>{mockData.privacyText}</Text>
            </ScrollView>
            <Pressable 
              style={styles.modalButton} 
              onPress={() => setIsPrivacyOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Register;
