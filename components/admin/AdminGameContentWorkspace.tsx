import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Modal, ScrollView, Text, TextInput, View, type TextStyle } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { toast } from 'sonner-native';
import AdminButton from './AdminButton';
import AdminDialog from './AdminDialog';
import AdminIconButton from './AdminIconButton';
import AdminListRow from './AdminListRow';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import AdminSection from './AdminSection';
import AdminState from './AdminState';
import AdminToolbar from './AdminToolbar';
import { AdminChoiceList } from './AdminReviewCard';
import GuessMap from '@/components/games/GuessMap';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import {
  adminGameContentService,
  GAME_DIFFICULTIES,
  type GameDifficulty,
  type ManagedGeoLocation,
  type ManagedWordleWord,
} from '@/lib/services/AdminGameContentService';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ActiveTab = 'locations' | 'words';
type DeleteTarget = { type: 'location'; item: ManagedGeoLocation } | { type: 'word'; item: ManagedWordleWord };
type PickedImage = { base64: string; mimeType: 'image/jpeg'; previewUri: string };

const INITIAL_COORDINATES = { lat: 10.45, lng: -61.25 };
const formatCoordinate = (value: number): string => value.toFixed(6);
const isActiveTab = (value: string): value is ActiveTab => value === 'locations' || value === 'words';
const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export default function AdminGameContentWorkspace() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ActiveTab>('locations');
  const [locations, setLocations] = useState<ManagedGeoLocation[]>([]);
  const [words, setWords] = useState<ManagedWordleWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A save or delete that worked but whose list reload failed: shown above the list until the next good load.
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Location form
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('easy');
  const [info, setInfo] = useState('');
  const [hint, setHint] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [coordinates, setCoordinates] = useState(INITIAL_COORDINATES);
  const [latitudeInput, setLatitudeInput] = useState(formatCoordinate(INITIAL_COORDINATES.lat));
  const [longitudeInput, setLongitudeInput] = useState(formatCoordinate(INITIAL_COORDINATES.lng));

  // Word form
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');

  const loadContent = useCallback(async (mode: 'initial' | 'refresh' | 'reload' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'reload') setListLoading(true);
    else setLoading(true);
    setError(null);
    try {
      const content = await adminGameContentService.fetchContent();
      setLocations(content.locations);
      setWords(content.words);
      setListNotice(null);
    } catch (loadError: unknown) {
      console.error('[AdminGameContentWorkspace.loadContent] Error:', loadError instanceof Error ? loadError.message : loadError);
      const text = loadError instanceof Error ? loadError.message : 'Unable to load game content';
      // A reload follows a save that already succeeded: say so, so the admin doesn't save the same item twice.
      if (mode === 'reload') setListNotice(`Saved, but the list could not be refreshed (${text}). Pull down to refresh.`);
      else setError(text);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const filteredLocations = useMemo(
    () => locations.filter((location) => location.name.toLowerCase().includes(query.toLowerCase())),
    [locations, query]
  );
  const filteredWords = useMemo(
    () => words.filter((entry) => entry.word.includes(query.toUpperCase()) || entry.definition.toLowerCase().includes(query.toLowerCase())),
    [words, query]
  );

  const handleCoordinateInputChange = (kind: 'latitude' | 'longitude', value: string): void => {
    if (kind === 'latitude') setLatitudeInput(value);
    else setLongitudeInput(value);
    const parsed = adminGameContentService.validateCoordinate(kind, value);
    if (parsed === null) return;
    setCoordinates((current) => (kind === 'latitude' ? { ...current, lat: parsed } : { ...current, lng: parsed }));
  };

  const handleMapPress = (next: { lat: number; lng: number }): void => {
    setCoordinates(next);
    setLatitudeInput(formatCoordinate(next.lat));
    setLongitudeInput(formatCoordinate(next.lng));
  };

  const handlePickImage = async (): Promise<void> => {
    setFormError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFormError('Photo library permission is required to upload a location image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.uri) return;
      setPickedImage(await adminGameContentService.prepareImage(asset.uri));
    } catch (pickError: unknown) {
      console.error('[AdminGameContentWorkspace.handlePickImage] Error:', pickError instanceof Error ? pickError.message : pickError);
      setFormError(pickError instanceof Error ? pickError.message : 'Could not open photo library.');
    }
  };

  const resetLocationForm = (): void => {
    setName('');
    setDifficulty('easy');
    setInfo('');
    setHint('');
    setImageUrl('');
    setPickedImage(null);
    setCoordinates(INITIAL_COORDINATES);
    setLatitudeInput(formatCoordinate(INITIAL_COORDINATES.lat));
    setLongitudeInput(formatCoordinate(INITIAL_COORDINATES.lng));
  };

  const handleLocationSubmit = async (): Promise<void> => {
    if (saving) return;
    const latitude = adminGameContentService.validateCoordinate('latitude', latitudeInput);
    const longitude = adminGameContentService.validateCoordinate('longitude', longitudeInput);
    if (latitude === null || longitude === null) {
      setFormError('Enter a valid latitude and longitude');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await adminGameContentService.addLocation({
        name,
        difficulty,
        info,
        hint,
        imageUrl,
        image: pickedImage ? { base64: pickedImage.base64, mimeType: pickedImage.mimeType } : null,
        latitude,
        longitude,
      });
      resetLocationForm();
      setFormOpen(false);
      toast.success('GeoGuesser location added');
      await loadContent('reload');
    } catch (saveError: unknown) {
      console.error('[AdminGameContentWorkspace.handleLocationSubmit] Error:', saveError instanceof Error ? saveError.message : saveError);
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleWordSubmit = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await adminGameContentService.addWord(word, definition);
      setWord('');
      setDefinition('');
      setFormOpen(false);
      toast.success('Wordle word saved');
      await loadContent('reload');
    } catch (saveError: unknown) {
      console.error('[AdminGameContentWorkspace.handleWordSubmit] Error:', saveError instanceof Error ? saveError.message : saveError);
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to save word');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (deleteTarget.type === 'location') {
        const removed = deleteTarget.item;
        await adminGameContentService.deleteLocation(removed);
        // Drop it now so it isn't still listed if the reload below fails.
        setLocations((current) => current.filter((location) => !(location.id === removed.id && location.difficulty === removed.difficulty)));
      } else {
        const removed = deleteTarget.item;
        await adminGameContentService.deleteWord(removed);
        setWords((current) => current.filter((entry) => entry.id !== removed.id));
      }
      setDeleteTarget(null);
      toast.success('Content removed');
      await loadContent('reload');
    } catch (deleteFailure: unknown) {
      console.error('[AdminGameContentWorkspace.handleDelete] Error:', deleteFailure instanceof Error ? deleteFailure.message : deleteFailure);
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : 'Unable to delete content');
    } finally {
      setDeleting(false);
    }
  };

  const openForm = (prefill?: ManagedWordleWord): void => {
    setFormError(null);
    if (prefill) {
      setWord(prefill.word);
      setDefinition(prefill.definition);
    }
    setFormOpen(true);
  };

  const closeForm = (): void => {
    if (saving) return;
    setFormOpen(false);
  };

  const inputStyle: TextStyle[] = [
    type.body,
    { minHeight: ADMIN_MIN_TOUCH, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text },
  ];
  const renderField = (label: string, field: ReactNode) => (
    <View style={{ gap: space.xs }}>
      <Text style={[type.label, { color: colors.secondaryText }]}>{label}</Text>
      {field}
    </View>
  );

  const isLocations = activeTab === 'locations';
  const visibleCount = isLocations ? filteredLocations.length : filteredWords.length;
  const totalCount = isLocations ? locations.length : words.length;
  const screenState: AdminScreenState = loading ? { kind: 'loading', variant: 'list' } : error ? { kind: 'error', message: error } : { kind: 'ready' };
  const positive = getAdminTone(colors, 'positive');

  const renderList = () => {
    if (listLoading) return <AdminState kind="loading" variant="list" rows={3} />;
    if (!visibleCount) {
      return (
        <AdminState
          kind="empty"
          icon={isLocations ? 'map-pin' : 'book-open'}
          title={isLocations ? 'No locations yet' : 'No words yet'}
          description={isLocations ? 'Add a landmark to the GeoGuesser pool.' : 'Add a five-letter answer to the Wordle dictionary.'}
          filtered={Boolean(query.trim())}
          onClearFilters={() => setQuery('')}
        />
      );
    }
    if (isLocations) {
      return filteredLocations.map((location) => (
        <AdminListRow
          key={`${location.difficulty}-${location.id}`}
          title={location.name}
          subtitle={location.info || 'No description'}
          leading={{ kind: 'thumb', uri: location.imageUrl || undefined }}
          status={{ label: capitalize(location.difficulty), tone: 'neutral' }}
          overflowActions={[{ key: 'delete', label: 'Delete…', icon: 'trash-2', tone: 'danger', onPress: () => { setDeleteError(null); setDeleteTarget({ type: 'location', item: location }); } }]}
        />
      ));
    }
    return filteredWords.map((entry) => (
      <AdminListRow
        key={entry.id}
        title={entry.word}
        subtitle={entry.definition}
        leading={{ kind: 'icon', name: 'type', tone: 'positive' }}
        overflowActions={[
          { key: 'edit', label: 'Edit definition', icon: 'edit-2', onPress: () => openForm(entry) },
          { key: 'delete', label: 'Delete…', icon: 'trash-2', tone: 'danger', onPress: () => { setDeleteError(null); setDeleteTarget({ type: 'word', item: entry }); } },
        ]}
      />
    ));
  };

  const locationForm = (
    <>
      <AdminSection title="Details">
        {renderField('Name', <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.mutedText} accessibilityLabel="Name" style={inputStyle} />)}
        <AdminChoiceList label="Difficulty" value={difficulty} onChange={setDifficulty} disabled={saving} options={GAME_DIFFICULTIES.map((level) => ({ value: level, label: capitalize(level) }))} />
        {renderField('Description', <TextInput value={info} onChangeText={setInfo} multiline accessibilityLabel="Description" style={[...inputStyle, { minHeight: 76, textAlignVertical: 'top' }]} />)}
        {renderField('Hint', <TextInput value={hint} onChangeText={setHint} accessibilityLabel="Hint" style={inputStyle} />)}
      </AdminSection>

      <AdminSection title="Image" description="Upload a landmark image, or paste an image URL.">
        {/* The picker and the remove control are siblings, never nested touchables. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AdminPressable
            onPress={() => void handlePickImage()}
            accessibilityRole="button"
            accessibilityLabel={pickedImage ? 'Change image' : 'Upload image'}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
              padding: space.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.border,
              backgroundColor: colors.input,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {pickedImage ? <Image source={{ uri: pickedImage.previewUri }} style={{ width: 44, height: 44, borderRadius: radius.sm }} /> : <Icon name="image" size={20} color={colors.accentText} />}
            <Text style={[type.bodyStrong, { color: colors.text }]}>{pickedImage ? 'Change image' : 'Upload image'}</Text>
          </AdminPressable>
          {pickedImage ? <AdminIconButton icon="x" label="Remove picked image" tone="danger" variant="soft" onPress={() => setPickedImage(null)} /> : null}
        </View>
        {renderField('Or image URL', <TextInput value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" placeholderTextColor={colors.mutedText} autoCapitalize="none" keyboardType="url" accessibilityLabel="Image URL" style={inputStyle} />)}
      </AdminSection>

      <AdminSection title="Map" description="Tap the exact point on the map, or type the coordinates.">
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            {renderField('Latitude', <TextInput value={latitudeInput} onChangeText={(value) => handleCoordinateInputChange('latitude', value)} keyboardType="numbers-and-punctuation" accessibilityLabel="Latitude" style={inputStyle} />)}
          </View>
          <View style={{ flex: 1 }}>
            {renderField('Longitude', <TextInput value={longitudeInput} onChangeText={(value) => handleCoordinateInputChange('longitude', value)} keyboardType="numbers-and-punctuation" accessibilityLabel="Longitude" style={inputStyle} />)}
          </View>
        </View>
        <View style={{ height: 300, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <GuessMap guess={coordinates} actual={null} locked={false} onGuess={handleMapPress} />
        </View>
        <View style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: positive.border, backgroundColor: positive.soft }}>
          <Text style={[type.meta, { color: positive.text }]}>Selected: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</Text>
        </View>
      </AdminSection>
    </>
  );

  const wordForm = (
    <AdminSection title="Wordle answer" description="Five letters only. Saving an existing word updates its definition.">
      {renderField('Word', (
        <TextInput
          value={word}
          onChangeText={(value) => setWord(value.replace(/[^A-Za-z]/g, '').toUpperCase())}
          maxLength={5}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Word"
          style={[...inputStyle, { fontFamily: 'monospace', fontSize: 18, letterSpacing: 6 }]}
        />
      ))}
      {renderField('Definition', <TextInput value={definition} onChangeText={setDefinition} multiline accessibilityLabel="Definition" style={[...inputStyle, { minHeight: 96, textAlignVertical: 'top' }]} />)}
    </AdminSection>
  );

  return (
    <AdminScreen
      title="Game content"
      subtitle="Trini GeoGuesser locations and the Trini Wordle dictionary"
      state={screenState}
      refreshing={refreshing}
      onRefresh={() => loadContent('refresh')}
      primaryAction={{ key: 'add', label: isLocations ? 'Add location' : 'Add word', icon: 'plus', onPress: () => openForm() }}
      toolbar={(
        <AdminToolbar
          segments={{
            value: activeTab,
            options: [
              { value: 'locations', label: 'GeoGuesser', count: loading ? undefined : locations.length },
              { value: 'words', label: 'Wordle', count: loading ? undefined : words.length },
            ],
            onChange: (next) => {
              if (!isActiveTab(next)) return;
              setActiveTab(next);
              setQuery('');
            },
          }}
          search={{ value: query, placeholder: isLocations ? 'Search locations' : 'Search words', onChange: setQuery }}
          resultSummary={loading || error ? undefined : `${visibleCount} of ${totalCount} ${isLocations ? 'locations' : 'words'}`}
        />
      )}
    >
      <View style={{ gap: space.sm }}>
        {listNotice ? <AdminState kind="inlineError" message={listNotice} onRetry={() => void loadContent('reload')} /> : null}
        {renderList()}
      </View>

      <Modal visible={formOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeForm}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <AdminIconButton icon="x" label="Close form" iconSize={22} disabled={saving} onPress={closeForm} />
            <Text accessibilityRole="header" numberOfLines={1} style={[type.title, { flex: 1, color: colors.text }]}>{isLocations ? 'Add a location' : 'Add a Wordle answer'}</Text>
          </View>
          {/* The header stays outside the keyboard-safe area; the body and the sticky Save stay above the keyboard. */}
          <KeyboardSafeView style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, gap: space.lg, padding: space.lg, paddingBottom: space.xxl }}>
              {isLocations ? locationForm : wordForm}
              {formError ? <AdminState kind="inlineError" message={formError} /> : null}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.navigation }}>
              <AdminButton label="Cancel" tone="neutral" disabled={saving} onPress={closeForm} style={{ flex: 1 }} />
              <AdminButton
                label={saving ? (isLocations ? 'Uploading…' : 'Saving…') : isLocations ? 'Add location' : 'Save word'}
                icon="check"
                tone="positive"
                emphasis="primary"
                busy={saving}
                onPress={() => void (isLocations ? handleLocationSubmit() : handleWordSubmit())}
                style={{ flex: 1 }}
              />
            </View>
          </KeyboardSafeView>
        </SafeAreaView>
      </Modal>

      <AdminDialog
        visible={Boolean(deleteTarget)}
        title="Remove game content"
        description={deleteTarget ? `Remove ${deleteTarget.type === 'word' ? deleteTarget.item.word : deleteTarget.item.name}? This cannot be undone.` : ''}
        confirmLabel="Remove"
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      >
        {deleteError ? <AdminState kind="inlineError" message={deleteError} /> : null}
      </AdminDialog>
    </AdminScreen>
  );
}
