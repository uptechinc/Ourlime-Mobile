import generatedPolicyDocuments from '@/lib/policies/generatedPolicyDocuments.json';
import { childSafetyPolicyDocument, type PolicyDocument, type PolicySection } from '@/lib/policies/childSafetyPolicyDocument';
import { privacyPolicyDocument } from '@/lib/policies/privacyPolicyDocument';
import { OURLIME_SITE_URL } from '@/lib/constants/site';

export type { PolicyDocument, PolicyItem, PolicySection } from '@/lib/policies/childSafetyPolicyDocument';

const CHILD_SAFETY_POLICY_ID = 'child-safety-standards-policy';

/** A run of policy items: a paragraph, or consecutive list items shown as one bulleted list. */
export type PolicyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

/**
 * The website's policy documents (lib/policies on the web, copied into lib/policies here) in the same order as
 * the website's /policies page: Privacy, Child Safety, then the generated Safety, Community, Copyright and
 * Marketplace policies. Section ids match the website's anchors so shared links point at the same section.
 */
export class PolicyDocumentService {
  private static instance: PolicyDocumentService;
  private readonly documents: readonly PolicyDocument[];

  private constructor() {
    const otherDocuments = (generatedPolicyDocuments as PolicyDocument[])
      .filter((policyDocument) => policyDocument.id !== CHILD_SAFETY_POLICY_ID);
    this.documents = [privacyPolicyDocument, childSafetyPolicyDocument, ...otherDocuments];
  }

  public static getInstance(): PolicyDocumentService {
    if (!PolicyDocumentService.instance) PolicyDocumentService.instance = new PolicyDocumentService();
    return PolicyDocumentService.instance;
  }

  public getAll(): readonly PolicyDocument[] {
    return this.documents;
  }

  public getChildSafetyPolicy(): PolicyDocument {
    return childSafetyPolicyDocument;
  }

  /** Same id the website gives each section heading (app/policies/page.tsx formatSectionId). */
  public getSectionId(policyId: string, section: PolicySection, sectionIndex: number): string {
    const sectionNumber = section.number.replaceAll('.', '-').replace(/-$/, '');
    const sectionTitle = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `${policyId}-${sectionIndex + 1}-${sectionNumber}-${sectionTitle}`;
  }

  /** The website's direct link to a policy or one of its sections. */
  public getShareUrl(anchorId: string): string {
    return `${OURLIME_SITE_URL}/policies#${anchorId}`;
  }

  /** Groups consecutive list items into one list, as the website renders them. */
  public toBlocks(section: PolicySection): PolicyBlock[] {
    const blocks: PolicyBlock[] = [];
    section.items.forEach((item) => {
      const previous = blocks[blocks.length - 1];
      if (item.kind === 'list-item') {
        if (previous?.kind === 'list') previous.items.push(item.text);
        else blocks.push({ kind: 'list', items: [item.text] });
        return;
      }
      blocks.push({ kind: 'paragraph', text: item.text });
    });
    return blocks;
  }
}

export const policyDocumentService = PolicyDocumentService.getInstance();
