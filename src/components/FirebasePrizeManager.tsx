"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Trash2, Edit, Plus, RefreshCw } from 'lucide-react';
import { 
  addPrize, 
  getPrizes, 
  updatePrize, 
  deletePrize, 
  convertFirebasePrizeToAppPrize,
  type FirebasePrize 
} from '@/lib/firebaseService';
import { useAppContext } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';

export default function FirebasePrizeManager() {
  const [prizes, setPrizes] = useState<FirebasePrize[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrize, setEditingPrize] = useState<FirebasePrize | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: ''
  });
  
  const { dispatch } = useAppContext();

  const loadPrizes = async () => {
    setLoading(true);
    try {
      const firebasePrizes = await getPrizes();
      setPrizes(firebasePrizes);
      
      // Convert to app format and update context
      const appPrizes = firebasePrizes.map(convertFirebasePrizeToAppPrize);
      dispatch({
        type: 'SET_FIREBASE_PRIZES',
        payload: appPrizes
      });
      
    } catch (error: any) {
      console.error('Error loading prizes:', error);
      toast({
        title: "Error",
        description: "Failed to load prizes from Firebase",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrizes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingPrize) {
        // Update existing prize
        await updatePrize(editingPrize.id!, {
          name: formData.name,
          description: formData.description,
          imageUrl: formData.imageUrl
        });
        toast({
          title: "Success",
          description: "Prize updated successfully"
        });
      } else {
        // Add new prize
        await addPrize({
          name: formData.name,
          description: formData.description,
          imageUrl: formData.imageUrl,
          entries: [],
          totalTicketsInPrize: 0
        });
        toast({
          title: "Success",
          description: "Prize added successfully"
        });
      }
      
      await loadPrizes();
      setIsDialogOpen(false);
      setEditingPrize(null);
      setFormData({ name: '', description: '', imageUrl: '' });
      
    } catch (error: any) {
      console.error('Error saving prize:', error);
      toast({
        title: "Error",
        description: "Failed to save prize",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (prizeId: string) => {
    if (!confirm('Are you sure you want to delete this prize?')) return;
    
    setLoading(true);
    try {
      await deletePrize(prizeId);
      await loadPrizes();
      toast({
        title: "Success",
        description: "Prize deleted successfully"
      });
    } catch (error: any) {
      console.error('Error deleting prize:', error);
      toast({
        title: "Error",
        description: "Failed to delete prize",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (prize: FirebasePrize) => {
    setEditingPrize(prize);
    setFormData({
      name: prize.name,
      description: prize.description,
      imageUrl: prize.imageUrl
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingPrize(null);
    setFormData({ name: '', description: '', imageUrl: '' });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Firebase Prize Manager
            <div className="flex gap-2">
              <Button
                onClick={loadPrizes}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prize
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingPrize ? 'Edit Prize' : 'Add New Prize'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Prize Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                        placeholder="Enter prize name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        required
                        placeholder="Enter prize description"
                        rows={3}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="imageUrl">Image URL</Label>
                      <Input
                        id="imageUrl"
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                        required
                        placeholder="Enter image URL"
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : (editingPrize ? 'Update' : 'Add')} Prize
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && prizes.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Loading prizes...</p>
            </div>
          ) : prizes.length === 0 ? (
            <Alert>
              <AlertDescription>
                No prizes found. Add your first prize to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {prizes.map((prize) => (
                <Card key={prize.id} className="relative">
                  <CardContent className="p-4">
                    <div className="aspect-video mb-3 bg-gray-100 rounded-md overflow-hidden">
                      <img
                        src={prize.imageUrl}
                        alt={prize.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/300x200.png';
                        }}
                      />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{prize.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {prize.description}
                    </p>
                    <div className="text-xs text-muted-foreground mb-3">
                      Total Tickets: {prize.totalTicketsInPrize || 0}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(prize)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(prize.id!)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}