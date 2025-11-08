import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;

export const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // Match project background
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingTop: isTablet ? 20 : 16,
    paddingBottom: isTablet ? 20 : 16,
  },

  // Progress bar - More mobile-friendly
  progressContainer: {
    height: isTablet ? 6 : 4,
    backgroundColor: '#E5E7EB',
    borderRadius: isTablet ? 3 : 2,
    marginBottom: isTablet ? 24 : 20,
    marginHorizontal: isTablet ? 0 : 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: isTablet ? 3 : 2,
    position: 'relative',
  },
  progressLogo: {
    position: 'absolute',
    right: isTablet ? -8 : -6,
    top: isTablet ? -6 : -4,
    width: isTablet ? 20 : 16,
    height: isTablet ? 20 : 16,
    backgroundColor: 'white',
    borderRadius: isTablet ? 10 : 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  progressLogoText: {
    color: '#10b981',
    fontSize: isTablet ? 10 : 8,
    fontWeight: 'bold',
  },

  // Step content - More mobile-friendly card design
  stepContent: {
    backgroundColor: 'white',
    borderRadius: isTablet ? 16 : 12,
    padding: isTablet ? 32 : 20,
    minHeight: isTablet ? 500 : 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginHorizontal: isTablet ? 0 : 4,
  },
  stepContainer: {
    flex: 1,
  },

  // Header styles - Better mobile typography
  headerContainer: {
    alignItems: 'center',
    marginBottom: isTablet ? 32 : 24,
  },
  title: {
    fontSize: isTablet ? 28 : 22,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: isTablet ? 12 : 8,
    lineHeight: isTablet ? 36 : 28,
  },
  subtitle: {
    fontSize: isTablet ? 20 : 16,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: isTablet ? 16 : 12,
    lineHeight: isTablet ? 28 : 22,
  },
  greenText: {
    color: '#10b981',
  },

  // Form styles - Better mobile form design
  formContainer: {
    marginBottom: isTablet ? 32 : 24,
  },
  inputContainer: {
    marginBottom: isTablet ? 20 : 16,
  },
  label: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: isTablet ? 10 : 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: isTablet ? 12 : 10,
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 16 : 14,
    fontSize: isTablet ? 18 : 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: isTablet ? 56 : 48,
  },
  errorText: {
    color: '#EF4444',
    fontSize: isTablet ? 14 : 12,
    marginTop: isTablet ? 6 : 4,
    fontWeight: '500',
  },

  // Layout containers - Better responsive layout
  rowContainer: {
    flexDirection: isTablet ? 'row' : 'column',
    gap: isTablet ? 16 : 12,
  },
  columnContainer: {
    flexDirection: 'column',
    gap: isTablet ? 16 : 12,
  },

  // Checkbox styles - Better mobile checkboxes
  checkboxContainer: {
    marginTop: isTablet ? 24 : 20,
    gap: isTablet ? 16 : 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: isTablet ? 16 : 12,
  },
  checkbox: {
    width: isTablet ? 24 : 20,
    height: isTablet ? 24 : 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: isTablet ? 6 : 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkmark: {
    color: 'white',
    fontSize: isTablet ? 14 : 12,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: isTablet ? 16 : 14,
    color: '#374151',
    flex: 1,
    lineHeight: isTablet ? 24 : 20,
  },

  // Tab styles - Better mobile tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: isTablet ? 25 : 20,
    padding: isTablet ? 6 : 4,
    marginBottom: isTablet ? 32 : 24,
    alignSelf: 'center',
  },
  tab: {
    paddingHorizontal: isTablet ? 24 : 20,
    paddingVertical: isTablet ? 12 : 10,
    borderRadius: isTablet ? 20 : 16,
    minWidth: isTablet ? 100 : 80,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#10b981',
  },
  tabText: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: 'white',
  },

  // Avatar styles - Better responsive avatars
  avatarGrid: {
    marginBottom: isTablet ? 32 : 24,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: isTablet ? 20 : 16,
  },
  avatarColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: isTablet ? 20 : 16,
  },
  avatarItem: {
    width: isTablet ? 140 : 100,
    height: isTablet ? 140 : 100,
    borderRadius: isTablet ? 12 : 8,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  checkOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    backgroundColor: '#10b981',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkIcon: {
    width: 16,
    height: 16,
    tintColor: 'white',
  },

  // Interest chips
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#374151',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6b7280',
  },
  interestChipSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  interestChipText: {
    fontSize: 14,
    color: 'white',
  },
  interestChipTextSelected: {
    color: 'black',
    fontWeight: '500',
  },

  // Upload styles
  uploadContainer: {
    gap: 12,
    marginTop: 16,
  },
  uploadButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#6b7280',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  uploadText: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '500',
  },

  // Button styles - Better mobile buttons
  buttonRow: {
    flexDirection: isTablet ? 'row' : 'column',
    gap: isTablet ? 16 : 12,
    marginTop: isTablet ? 32 : 24,
  },
  button: {
    flex: isTablet ? 1 : 0,
    paddingVertical: isTablet ? 16 : 14,
    paddingHorizontal: isTablet ? 32 : 24,
    borderRadius: isTablet ? 25 : 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isTablet ? 56 : 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#10b981',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  buttonText: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: 'white',
  },
  secondaryButtonText: {
    color: '#10b981',
  },

  // Link styles - Better mobile links
  linkText: {
    fontSize: isTablet ? 16 : 14,
    color: '#10b981',
    textAlign: 'center',
    marginVertical: isTablet ? 20 : 16,
    fontWeight: '500',
  },

  // Info text - Better mobile info text
  infoText: {
    fontSize: isTablet ? 16 : 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: isTablet ? 24 : 20,
    marginBottom: isTablet ? 24 : 16,
  },

  // Modal styles - Better mobile modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? 32 : 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: isTablet ? 16 : 12,
    padding: isTablet ? 32 : 20,
    maxHeight: isTablet ? '85%' : '80%',
    width: '100%',
    maxWidth: isTablet ? 600 : 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: isTablet ? 24 : 20,
    textAlign: 'center',
    lineHeight: isTablet ? 32 : 28,
  },
  modalText: {
    fontSize: isTablet ? 16 : 14,
    color: '#374151',
    lineHeight: isTablet ? 24 : 20,
    marginBottom: isTablet ? 32 : 24,
    textAlign: 'left',
  },
  modalButton: {
    backgroundColor: '#10b981',
    paddingVertical: isTablet ? 16 : 14,
    paddingHorizontal: isTablet ? 32 : 24,
    borderRadius: isTablet ? 12 : 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: {
    color: 'white',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
  },
  modalCloseButton: {
    position: 'absolute',
    top: isTablet ? 16 : 12,
    right: isTablet ? 16 : 12,
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalCloseButtonText: {
    fontSize: isTablet ? 20 : 16,
    color: '#6B7280',
    fontWeight: 'bold',
  },
});
