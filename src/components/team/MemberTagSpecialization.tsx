import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Select from '@/components/common/Select';

interface MemberTagSpecializationProps {
  memberId: string;
  organizationId: string;
  currentTag: string | null;
  onTagUpdate: (memberId: string, newTag: string | null) => Promise<void>;
}

export default function MemberTagSpecialization({
  memberId,
  organizationId,
  currentTag,
  onTagUpdate
}: MemberTagSpecializationProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState(currentTag || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTags = async () => {
      const { data: ticketTags } = await supabase
        .from('tickets')
        .select('tag')
        .eq('organization_id', organizationId)
        .not('tag', 'is', null);

      const uniqueTags = [...new Set(ticketTags?.map(t => t.tag))];
      setTags(uniqueTags);
      setIsLoading(false);
    };
    loadTags();
  }, [organizationId]);

  const options = [
    { label: 'General Support', value: '' },
    ...tags.map(tag => ({
      label: tag,
      value: tag
    }))
  ];

  const handleChange = async (value: string) => {
    const newTag = value || null;
    setSelectedTag(value);
    
    try {
      await onTagUpdate(memberId, newTag);
    } catch (error) {
      console.error('Error updating tag:', error);
      setSelectedTag(currentTag || '');
    }
  };

  return (
    <Select
      value={selectedTag}
      options={options}
      onChange={handleChange}
      isLoading={isLoading}
      placeholder="Select specialization"
    />
  );
} 