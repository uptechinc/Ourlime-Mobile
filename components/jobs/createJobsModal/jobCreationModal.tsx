/* components/jobCreation/JobCreationModal.tsx */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { X } from 'lucide-react-native';
import { JobTypeSelection } from './jobTypeSelection';
import { CompanyDetailsForm } from './CompanyDetailsForm';
import { ProjectDetailsForm } from './ProjectDetailsForm';
import { TaskDetailsForm } from './TaskDetailsForm';
import { BasicInformationForm } from './BasicInformationForm';
import { PromoteYourselfForm } from './FreelancePromo';
// import toast from 'react-hot-toast'; 
// import { auth } from '@/lib/firebaseConfig'; 
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function JobCreationModal({ isOpen, onClose }: Props) {
  const [jobCategory, setJobCategory] = useState<'professional' | 'freelancer' | 'quickTask'>('professional');
  const [freelancerOption, setFreelancerOption] = useState<'promoteSelf' | 'postRequest'>('promoteSelf');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [locationDetails, setLocationDetails] = useState({
    type: 'remote',
    address: '',
    city: '',
    country: '',
  });
  const [companyDetails, setCompanyDetails] = useState({
    name: '',
    size: '',
    industry: '',
    benefits: [] as string[],
  });
  const [freelancerDetails, setFreelancerDetails] = useState({
    name: '',
    skills: [] as string[],
    experience: '',
    portfolioLink: '',
    category: '',
    availability: 'Freelance' as 'Freelance' | 'Full-time' | 'Part-time',
    hourlyRate: '',
    bio: '',
  });
  const [projectDetails, setProjectDetails] = useState({
    timeline: '',
    milestones: [] as string[],
    deliverables: [] as string[],
    technicalRequirements: [] as string[],
  });
  const [taskDetails, setTaskDetails] = useState({
    urgency: 'medium' as 'low' | 'medium' | 'high',
    duration: '',
    complexity: 'moderate' as 'simple' | 'moderate' | 'complex',
  });
  const [newBenefit, setNewBenefit] = useState('');
  const [questions, setQuestions] = useState<
    { question: string; answerType: 'input' | 'checkbox' | 'dropdown'; options: string[] }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = (
    item: string,
    items: string[],
    setter: (i: string[]) => void,
    clear: () => void
  ) => {
    const t = item.trim();
    if (!t) return;
    setter([...items, t]);
    clear();
  };

  const removeItem = (idx: number, items: string[], setter: (i: string[]) => void) =>
    setter(items.filter((_, i) => i !== idx));

  const addQuestion = () =>
    setQuestions([...questions, { question: '', answerType: 'input', options: [] }]);
  const removeQuestion = (idx: number) =>
    setQuestions(questions.filter((_, i) => i !== idx));
  const updateQuestion = (idx: number, field: any, value: any) => {
    const q = [...questions];
    q[idx] = {
      ...q[idx],
      [field]: value,
      options: field === 'answerType' && value === 'input' ? [] : q[idx].options,
    };
    setQuestions(q);
  };
  const addOption = (qIdx: number) => {
    const q = [...questions];
    q[qIdx].options.push('');
    setQuestions(q);
  };
  const updateOption = (qIdx: number, oIdx: number, v: string) => {
    const q = [...questions];
    q[qIdx].options[oIdx] = v;
    setQuestions(q);
  };
  const removeOption = (qIdx: number, oIdx: number) => {
    const q = [...questions];
    q[qIdx].options = q[qIdx].options.filter((_, i) => i !== oIdx);
    setQuestions(q);
  };

  const handleSubmit = async () => {
    // basic validation here...
    setSubmitting(true);
    try {
      // simulate
      await new Promise((r) => setTimeout(r, 1000));
      onClose();
    } catch {
      //
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      {/* backdrop */}
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />

      {/* sheet */}
      <View
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          right: '5%',
          bottom: '10%',
          backgroundColor: '#FFF',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }}>
            Create New Job
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <X size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* body */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <JobTypeSelection
            jobCategory={jobCategory}
            setJobCategory={setJobCategory}
            freelancerOption={freelancerOption}
            setFreelancerOption={setFreelancerOption}
          />

          {jobCategory === 'freelancer' && freelancerOption === 'promoteSelf' ? (
            <>
              <PromoteYourselfForm
                freelancerDetails={freelancerDetails}
                setFreelancerDetails={(d) => setFreelancerDetails((p) => ({ ...p, ...d }))}
              />
              <BasicInformationForm
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                category={category}
                setCategory={setCategory}
              />
            </>
          ) : (
            <>
              {jobCategory === 'professional' && (
                <CompanyDetailsForm
                  companyDetails={companyDetails}
                  setCompanyDetails={setCompanyDetails}
                  newBenefit={newBenefit}
                  setNewBenefit={setNewBenefit}
                />
              )}
              {jobCategory === 'freelancer' && freelancerOption === 'postRequest' && (
                <ProjectDetailsForm
                  projectDetails={projectDetails}
                  setProjectDetails={setProjectDetails}
                />
              )}
              {jobCategory === 'quickTask' && (
                <TaskDetailsForm
                  taskDetails={taskDetails}
                  setTaskDetails={setTaskDetails}
                />
              )}
              <BasicInformationForm
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                category={category}
                setCategory={setCategory}
              />

              {/* Price Range */}
              <View
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  Price Range
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>From</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={priceFrom}
                      onChangeText={setPriceFrom}
                      placeholder="Min"
                      style={{
                        borderWidth: 1,
                        borderColor: '#D1D5DB',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>To</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={priceTo}
                      onChangeText={setPriceTo}
                      placeholder="Max"
                      style={{
                        borderWidth: 1,
                        borderColor: '#D1D5DB',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Location, Skills, Questions etc. */}
              {/* ...you can fill in the rest similarly, using inline styles and RN inputs */}
            </>
          )}
        </ScrollView>

        {/* footer */}
        <View
          style={{
            flexDirection: 'row',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '600', color: '#374151' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              flex: 1,
              backgroundColor: '#01eb53',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Create Job</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
