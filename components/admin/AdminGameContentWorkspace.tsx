import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import AdminDialog from './AdminDialog';
import GuessMap from '@/components/games/GuessMap';
import CustomModal from '@/components/ui/CustomModal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  adminGameContentService,
  GAME_DIFFICULTIES,
  type GameDifficulty,
  type ManagedGeoLocation,
  type ManagedWordleWord,
} from '@/lib/services/AdminGameContentService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ActiveTab = 'locations' | 'words';
type DeleteTarget = { type: 'location'; item: ManagedGeoLocation } | { type: 'word'; item: ManagedWordleWord };
type PickedImage = { base64: string; mimeType: 'image/jpeg'; previewUri: string };

const INITIAL_COORDINATES = { lat: 10.45, lng: -61.25 };
const formatCoordinate = (value: number): string => value.toFixed(6);

export default function AdminGameContentWorkspace() {
  const { colors } = useAppTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('locations');
  const [locations, setLocations] = useState<ManagedGeoLocation[]>([]);
  const [words, setWords] = useState<ManagedWordleWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    } catch (loadError: unknown) {
      console.error('[AdminGameContentWorkspace.loadContent] Error:', loadError instanceof Error ? loadError.message : loadError);
      const text = loadError instanceof Error ? loadError.message : 'Unable to load game content';
      if (mode === 'reload') setMessage(text);
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
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage('Photo library permission is required to upload a location image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.uri) return;
      setPickedImage(await adminGameContentService.prepareImage(asset.uri));
    } catch (pickError: unknown) {
      console.error('[AdminGameContentWorkspace.handlePickImage] Error:', pickError instanceof Error ? pickError.message : pickError);
      setMessage(pickError instanceof Error ? pickError.message : 'Could not open photo library.');
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
      setMessage('Enter a valid latitude and longitude');
      return;
    }
    setSaving(true);
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
      setMessage('GeoGuesser location added');
      await loadContent('reload');
    } catch (saveError: unknown) {
      console.error('[AdminGameContentWorkspace.handleLocationSubmit] Error:', saveError instanceof Error ? saveError.message : saveError);
      setMessage(saveError instanceof Error ? saveError.message : 'Unable to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleWordSubmit = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      await adminGameContentService.addWord(word, definition);
      setWord('');
      setDefinition('');
      setMessage('Wordle word added');
      await loadContent('reload');
    } catch (saveError: unknown) {
      console.error('[AdminGameContentWorkspace.handleWordSubmit] Error:', saveError instanceof Error ? saveError.message : saveError);
      setMessage(saveError instanceof Error ? saveError.message : 'Unable to save word');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'location') await adminGameContentService.deleteLocation(deleteTarget.item);
      else await adminGameContentService.deleteWord(deleteTarget.item);
      setDeleteTarget(null);
      setMessage('Content removed');
      await loadContent('reload');
    } catch (deleteError: unknown) {
      console.error('[AdminGameContentWorkspace.handleDelete] Error:', deleteError instanceof Error ? deleteError.message : deleteError);
      setMessage(deleteError instanceof Error ? deleteError.message : 'Unable to delete content');
    } finally {
      setDeleting(false);
    }
  };

  const inputStyle = { marginTop: 5, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text };
  const labelStyle = { marginTop: 12, color: colors.text, fontSize: 13, fontWeight: '700' as const };
  const cardStyle = { marginBottom: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface };

  const submitButton = (label: string, busyLabel: string, onPress: () => void) => (
    <TouchableOpacity
      disabled={saving}
      onPress={onPress}
      style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 14, backgroundColor: colors.successSurface, opacity: saving ? 0.6 : 1 }}
    >
      {saving ? <ActivityIndicator size="small" color={colors.successText} /> : <Icon name="plus" size={16} color={colors.successText} />}
      <Text style={{ marginLeft: 7, color: colors.successText, fontWeight: '900' }}>{saving ? busyLabel : label}</Text>
    </TouchableOpacity>
  );

  const listHeader = (title: string) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{title}</Text>
      <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 11 }}>
        <Icon name="search" size={16} color={colors.mutedText} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search…" placeholderTextColor={colors.mutedText} style={{ flex: 1, padding: 10, color: colors.text }} />
      </View>
    </View>
  );

  const listSkeleton = (
    <View>
      {[0, 1, 2].map((rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', marginBottom: 10, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas }}>
          <Skeleton width={activeTab === 'locations' ? 84 : 76} height={activeTab === 'locations' ? 66 : 34} borderRadius={10} />
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="85%" height={11} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <AdminWorkspaceShell
      title="Game Content Studio"
      subtitle="Manage live Trini GeoGuesser locations and the Trini Wordle dictionary."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => void loadContent('refresh')}
    >
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        {([
          { key: 'locations', label: 'GeoGuesser', icon: 'map-pin' },
          { key: 'words', label: 'Wordle words', icon: 'book-open' },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => { setActiveTab(tab.key); setQuery(''); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: activeTab === tab.key ? colors.accent : colors.border, backgroundColor: activeTab === tab.key ? colors.successSurface : colors.control }}
          >
            <Icon name={tab.icon} size={15} color={activeTab === tab.key ? colors.successText : colors.mutedText} />
            <Text style={{ marginLeft: 6, color: activeTab === tab.key ? colors.successText : colors.secondaryText, fontWeight: '800' }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => void loadContent('reload')} accessibilityLabel="Refresh" style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', borderRadius: 13, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control }}>
          <Icon name="refresh-cw" size={15} color={colors.icon} />
        </TouchableOpacity>
      </View>

      {activeTab === 'locations' ? (
        <>
          <View style={cardStyle}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Add a location</Text>
            <Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 13 }}>Upload a landmark image, then tap the exact point on the map.</Text>
            <Text style={labelStyle}>Name</Text>
            <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.mutedText} style={inputStyle} />
            <Text style={labelStyle}>Difficulty</Text>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              {GAME_DIFFICULTIES.map((level) => (
                <TouchableOpacity key={level} onPress={() => setDifficulty(level)} style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: difficulty === level ? colors.accent : colors.control }}>
                  <Text style={{ color: difficulty === level ? colors.onAccent : colors.secondaryText, fontWeight: '800', textTransform: 'capitalize' }}>{level}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={labelStyle}>Description</Text>
            <TextInput value={info} onChangeText={setInfo} multiline style={[inputStyle, { minHeight: 76, textAlignVertical: 'top' }]} />
            <Text style={labelStyle}>Hint</Text>
            <TextInput value={hint} onChangeText={setHint} style={inputStyle} />
            <TouchableOpacity onPress={() => void handlePickImage()} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.input }}>
              {pickedImage ? (
                <Image source={{ uri: pickedImage.previewUri }} style={{ width: 44, height: 44, borderRadius: 9, marginRight: 10 }} />
              ) : (
                <Icon name="image" size={19} color={colors.accent} />
              )}
              <Text style={{ marginLeft: pickedImage ? 0 : 8, color: colors.text, fontWeight: '800' }}>{pickedImage ? 'Change image' : 'Upload image'}</Text>
              {pickedImage ? (
                <TouchableOpacity onPress={() => setPickedImage(null)} accessibilityLabel="Remove picked image" style={{ marginLeft: 10, padding: 4 }}>
                  <Icon name="x" size={17} color={colors.destructiveText} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
            <Text style={labelStyle}>Or image URL</Text>
            <TextInput value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" placeholderTextColor={colors.mutedText} autoCapitalize="none" keyboardType="url" style={inputStyle} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={labelStyle}>Latitude</Text>
                <TextInput value={latitudeInput} onChangeText={(value) => handleCoordinateInputChange('latitude', value)} keyboardType="numbers-and-punctuation" style={inputStyle} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Longitude</Text>
                <TextInput value={longitudeInput} onChangeText={(value) => handleCoordinateInputChange('longitude', value)} keyboardType="numbers-and-punctuation" style={inputStyle} />
              </View>
            </View>
            <View style={{ height: 300, marginTop: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <GuessMap guess={coordinates} actual={null} locked={false} onGuess={handleMapPress} />
            </View>
            <Text style={{ marginTop: 10, padding: 10, borderRadius: 12, overflow: 'hidden', color: colors.successText, backgroundColor: colors.successSurface, fontSize: 13 }}>
              Selected: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            </Text>
            {submitButton('Add location', 'Uploading…', () => void handleLocationSubmit())}
          </View>

          <View style={cardStyle}>
            {listHeader(`${locations.length} managed locations`)}
            {listLoading ? listSkeleton : filteredLocations.length === 0 ? (
              <Text style={{ paddingVertical: 24, textAlign: 'center', color: colors.mutedText }}>No locations match.</Text>
            ) : filteredLocations.map((location) => (
              <View key={`${location.difficulty}-${location.id}`} style={{ flexDirection: 'row', marginBottom: 10, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas }}>
                <View style={{ width: 84, height: 66, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.control }}>
                  {location.imageUrl ? <Image source={{ uri: location.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800' }}>{location.name}</Text>
                      <Text style={{ color: colors.successText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{location.difficulty}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setDeleteTarget({ type: 'location', item: location })} accessibilityLabel={`Delete ${location.name}`} style={{ padding: 6 }}>
                      <Icon name="trash-2" size={16} color={colors.destructiveText} />
                    </TouchableOpacity>
                  </View>
                  <Text numberOfLines={2} style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>{location.info || 'No description'}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={cardStyle}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Add a Wordle answer</Text>
            <Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 13 }}>Five letters only. Saving an existing word updates its definition.</Text>
            <Text style={labelStyle}>Word</Text>
            <TextInput
              value={word}
              onChangeText={(value) => setWord(value.replace(/[^A-Za-z]/g, '').toUpperCase())}
              maxLength={5}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[inputStyle, { fontFamily: 'monospace', fontSize: 18, letterSpacing: 6 }]}
            />
            <Text style={labelStyle}>Definition</Text>
            <TextInput value={definition} onChangeText={setDefinition} multiline style={[inputStyle, { minHeight: 96, textAlignVertical: 'top' }]} />
            {submitButton('Add word', 'Saving…', () => void handleWordSubmit())}
          </View>

          <View style={cardStyle}>
            {listHeader(`${words.length} managed words`)}
            {listLoading ? listSkeleton : filteredWords.length === 0 ? (
              <Text style={{ paddingVertical: 24, textAlign: 'center', color: colors.mutedText }}>No words match.</Text>
            ) : filteredWords.map((entry) => (
              <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas }}>
                <Text style={{ overflow: 'hidden', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, fontFamily: 'monospace', fontWeight: '900', letterSpacing: 3, color: colors.successText, backgroundColor: colors.successSurface }}>{entry.word}</Text>
                <Text style={{ flex: 1, marginLeft: 11, color: colors.mutedText, fontSize: 13 }}>{entry.definition}</Text>
                <TouchableOpacity onPress={() => setDeleteTarget({ type: 'word', item: entry })} accessibilityLabel={`Delete ${entry.word}`} style={{ padding: 6 }}>
                  <Icon name="trash-2" size={16} color={colors.destructiveText} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}

      <AdminDialog
        visible={Boolean(deleteTarget)}
        title="Remove game content"
        description={deleteTarget ? `Remove ${deleteTarget.type === 'word' ? deleteTarget.item.word : deleteTarget.item.name}? This cannot be undone.` : ''}
        confirmLabel="Remove"
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
      <CustomModal visible={Boolean(message)} type="info" title="Game Content Studio" message={message ?? ''} onClose={() => setMessage(null)} />
    </AdminWorkspaceShell>
  );
}
