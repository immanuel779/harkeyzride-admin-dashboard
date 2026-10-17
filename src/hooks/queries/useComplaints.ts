import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchComplaints,
  updateComplaintApi,
  type Complaint,
  type ComplaintStatus,
} from '../../features/complaints/data/mockComplaints'

export const complaintKeys = {
  all: ['complaints'] as const,
  list: () => [...complaintKeys.all, 'list'] as const,
}

export function useComplaints() {
  return useQuery<Complaint[]>({
    queryKey: complaintKeys.list(),
    queryFn: fetchComplaints,
    refetchInterval: 60 * 1000,
  })
}

export function useUpdateComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string
      status: ComplaintStatus
      note?: string
    }) => updateComplaintApi(id, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: complaintKeys.all }),
  })
}