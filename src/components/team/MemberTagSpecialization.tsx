import { useState, useEffect } from 'react';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import Select from '@/components/common/Select';
import { Tag } from '@/types/tickets';

interface MemberTagSpecializationProps {
  memberId: string;
  organizationId: string;
  currentTag: string | null;
  onTagUpdate: (memberId: string, newTagId: string | null) => Promise<void>;
}

export default function MemberTagSpecialization({
  memberId,
  organizationId,
  currentTag,
  onTagUpdate
}: MemberTagSpecializationProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState(currentTag || '');
  const [isLoading, setIsLoading] = useState(true);

  // Update selectedTagId when currentTag changes
  useEffect(() => {
    setSelectedTagId(currentTag || '');
  }, [currentTag]);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tagData = await ticketQueries.getDistinctTags(organizationId);
        setTags(tagData);
      } catch (error) {
        console.error('Error loading tags:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTags();
  }, [organizationId]);

  const options = [
    { label: 'General Support', value: '' },
    ...tags.map(tag => ({
      label: tag.name,
      value: tag.id
    }))
  ];

  const handleChange = async (value: string) => {
    const newTagId = value || null;
    setSelectedTagId(value);
    
    try {
      await onTagUpdate(memberId, newTagId);
    } catch (error) {
      console.error('Error updating tag:', error);
      setSelectedTagId(currentTag || '');
    }
  };

  return (
    <Select
      value={selectedTagId}
      options={options}
      onChange={handleChange}
      isLoading={isLoading}
      placeholder="Select specialization"
    />
  );
} 