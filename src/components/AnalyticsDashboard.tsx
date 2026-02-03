"use client";

import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users, Ticket, Trophy, Target } from 'lucide-react';
import type { FirebaseUser } from '@/lib/firebaseService';

interface AnalyticsDashboardProps {
  firebaseUsers: FirebaseUser[];
}

const CHART_COLORS = [
  '#3F51B5', '#FFAB40', '#4CAF50', '#F44336', '#9C27B0',
  '#00BCD4', '#FF9800', '#795548', '#607D8B', '#E91E63',
];

const STATUS_COLORS: Record<string, string> = {
  at_party: '#4CAF50',
  working: '#FF9800',
  inactive: '#9E9E9E',
};

const STATUS_LABELS: Record<string, string> = {
  at_party: 'At Party',
  working: 'Working',
  inactive: 'Inactive',
};

export default function AnalyticsDashboard({ firebaseUsers }: AnalyticsDashboardProps) {
  const { state } = useAppContext();
  const { prizes, prizeTiers, winners, allUsers } = state;

  // Ticket distribution by prize
  const ticketsByPrize = useMemo(() => {
    return prizes
      .map(prize => ({
        name: prize.name.length > 20 ? prize.name.slice(0, 18) + '...' : prize.name,
        fullName: prize.name,
        tickets: prize.totalTicketsInPrize,
        participants: prize.entries.length,
      }))
      .sort((a, b) => b.tickets - a.tickets);
  }, [prizes]);

  // User status breakdown
  const userStatusData = useMemo(() => {
    const counts: Record<string, number> = { at_party: 0, working: 0, inactive: 0 };
    firebaseUsers.forEach(user => {
      const status = user.status || 'inactive';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count,
        color: STATUS_COLORS[status] || '#9E9E9E',
      }));
  }, [firebaseUsers]);

  // Tickets by tier
  const ticketsByTier = useMemo(() => {
    const tierMap = new Map(prizeTiers.map(t => [t.id, t]));
    const tierTickets: Record<string, { name: string; tickets: number; prizes: number; color: string }> = {};

    prizes.forEach(prize => {
      const tierId = prize.tierId || 'unassigned';
      const tier = tierMap.get(tierId);
      const key = tierId;

      if (!tierTickets[key]) {
        tierTickets[key] = {
          name: tier?.name || 'Unassigned',
          tickets: 0,
          prizes: 0,
          color: tier?.color || '#9E9E9E',
        };
      }
      tierTickets[key].tickets += prize.totalTicketsInPrize;
      tierTickets[key].prizes += 1;
    });

    return Object.values(tierTickets).sort((a, b) => b.tickets - a.tickets);
  }, [prizes, prizeTiers]);

  // Facility participation
  const facilityData = useMemo(() => {
    const facilities: Record<string, { total: number; atParty: number }> = {};
    firebaseUsers.forEach(user => {
      const facility = user.facilityName || 'Unknown';
      if (!facilities[facility]) {
        facilities[facility] = { total: 0, atParty: 0 };
      }
      facilities[facility].total += 1;
      if (user.status === 'at_party') {
        facilities[facility].atParty += 1;
      }
    });
    return Object.entries(facilities)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.slice(0, 13) + '...' : name,
        fullName: name,
        total: data.total,
        atParty: data.atParty,
        rate: data.total > 0 ? Math.round((data.atParty / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [firebaseUsers]);

  // Summary stats
  const stats = useMemo(() => {
    const totalTicketsAllocated = prizes.reduce((sum, p) => sum + p.totalTicketsInPrize, 0);
    const totalTicketsAvailable = firebaseUsers.reduce((sum, u) => sum + u.tickets, 0);
    const winnersCount = Object.values(winners).reduce((sum, ids) => sum + ids.length, 0);
    const prizesWithEntries = prizes.filter(p => p.entries.length > 0).length;
    const atPartyCount = firebaseUsers.filter(u => u.status === 'at_party').length;
    const participationRate = firebaseUsers.length > 0
      ? Math.round((atPartyCount / firebaseUsers.length) * 100)
      : 0;
    const allocationRate = totalTicketsAvailable > 0
      ? Math.round((totalTicketsAllocated / totalTicketsAvailable) * 100)
      : 0;

    return {
      totalTicketsAllocated,
      totalTicketsAvailable,
      winnersCount,
      prizesWithEntries,
      atPartyCount,
      participationRate,
      allocationRate,
      totalUsers: firebaseUsers.length,
      totalPrizes: prizes.length,
    };
  }, [prizes, winners, firebaseUsers]);

  // Top participants (users who allocated the most tickets)
  const topParticipants = useMemo(() => {
    const userTickets: Record<string, { name: string; tickets: number; prizesEntered: number }> = {};

    prizes.forEach(prize => {
      prize.entries.forEach(entry => {
        if (!userTickets[entry.userId]) {
          const userData = allUsers[entry.userId];
          userTickets[entry.userId] = {
            name: userData?.name || entry.userId,
            tickets: 0,
            prizesEntered: 0,
          };
        }
        userTickets[entry.userId].tickets += entry.numTickets;
        userTickets[entry.userId].prizesEntered += 1;
      });
    });

    return Object.values(userTickets)
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 5);
  }, [prizes, allUsers]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium">{data?.fullName || label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Participation Rate</div>
                <div className="text-2xl font-bold">{stats.participationRate}%</div>
                <div className="text-xs text-muted-foreground">
                  {stats.atPartyCount} of {stats.totalUsers} at party
                </div>
              </div>
              <div className="p-2 rounded-full bg-green-100 text-green-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Ticket Allocation Rate</div>
                <div className="text-2xl font-bold">{stats.allocationRate}%</div>
                <div className="text-xs text-muted-foreground">
                  {stats.totalTicketsAllocated} of {stats.totalTicketsAvailable} tickets used
                </div>
              </div>
              <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                <Ticket className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Prize Engagement</div>
                <div className="text-2xl font-bold">
                  {stats.totalPrizes > 0
                    ? Math.round((stats.prizesWithEntries / stats.totalPrizes) * 100)
                    : 0}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats.prizesWithEntries} of {stats.totalPrizes} prizes have entries
                </div>
              </div>
              <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Winners Drawn</div>
                <div className="text-2xl font-bold">{stats.winnersCount}</div>
                <div className="text-xs text-muted-foreground">
                  across {Object.keys(winners).length} prizes
                </div>
              </div>
              <div className="p-2 rounded-full bg-rose-100 text-rose-600">
                <Trophy className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tickets by Prize */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tickets by Prize
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticketsByPrize.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ticketsByPrize} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="tickets" fill="#3F51B5" radius={[4, 4, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No prize data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              User Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={userStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {userStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No user data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facility Participation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Facility Participation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {facilityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={facilityData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" fill="#9E9E9E" radius={[4, 4, 0, 0]} name="Total Users" />
                  <Bar dataKey="atParty" fill="#4CAF50" radius={[4, 4, 0, 0]} name="At Party" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No facility data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tickets by Tier */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tickets by Prize Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticketsByTier.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ticketsByTier} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="tickets" radius={[4, 4, 0, 0]} name="Tickets">
                    {ticketsByTier.map((entry, index) => (
                      <Cell key={index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No tier data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Participants Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topParticipants.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Rank</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Tickets Allocated</th>
                    <th className="text-left p-3 font-medium">Prizes Entered</th>
                  </tr>
                </thead>
                <tbody>
                  {topParticipants.map((user, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          #{index + 1}
                        </Badge>
                      </td>
                      <td className="p-3 font-medium">{user.name}</td>
                      <td className="p-3">{user.tickets}</td>
                      <td className="p-3">{user.prizesEntered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No ticket allocations yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
