import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { marketListingDetailService } from '@/lib/services/MarketListingDetailService';
import type { MarketPickupContacts } from '@/lib/types/reliability';

type MarketPickupContactProps = { ownerId: string | null; productId: string; productTitle: string };

/** Web components/market/checkout/MarketPickupContact.tsx: a listing's pickup contacts, phone → email → website. */
export default function MarketPickupContact({ ownerId, productId, productTitle }: MarketPickupContactProps) {
  const { colors } = useAppTheme();
  const [details, setDetails] = useState<MarketPickupContacts>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setDetails({ status: 'loading' });
    void marketListingDetailService.pickupContacts(ownerId, productId).then((result) => { if (active) setDetails(result); });
    return () => { active = false; };
  }, [ownerId, productId]);

  return <View style={{ gap: 4 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{productTitle}</Text>
    <View accessibilityLiveRegion="polite">
      {details.status === 'loading' ? <Text style={{ color: colors.mutedText }}>Loading seller contact details…</Text> : null}
      {details.status === 'unavailable' ? <Text style={{ color: colors.mutedText }}>Seller contact details could not be loaded.</Text> : null}
      {details.status === 'no-pickup' ? <Text style={{ color: colors.mutedText }}>This listing does not offer direct pickup.</Text> : null}
      {details.status === 'ready' ? details.contacts.length
        ? details.contacts.map((contact) => <View key={contact.type} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: colors.secondaryText, fontWeight: '700', textTransform: 'capitalize' }}>{contact.type}</Text>
          <Text selectable style={{ color: colors.secondaryText, flexShrink: 1 }}>{contact.value}</Text>
        </View>)
        : <Text style={{ color: colors.mutedText }}>The seller has not published contact details for this listing.</Text> : null}
    </View>
  </View>;
}
