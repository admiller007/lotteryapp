"use client";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit3, Trash2, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getAllPrizes, addPrize, updatePrize, deletePrize, initializeDefaultPrizes } from '@/lib/firebaseService';
import type { Prize } from '@/lib/types';

type PrizeFormData = Omit<Prize, 'id' | 'entries' | 'totalTicketsInPrize'>;

export default function FirebasePrizeManager() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [formData, setFormData] = useState<PrizeFormData>({
    name: '',
    description: '',
    imageUrl: '',
  });

  useEffect(() => {
    loadPrizes();
  }, []);

  const loadPrizes = async () => {
    try {
      setLoading(true);
      // Initialize default prizes if none exist
      await initializeDefaultPrizes();
      // Load all prizes
      const allPrizes = await getAllPrizes();
      setPrizes(allPrizes);
    } catch (error) {
      console.error('Error loading prizes:', error);
      toast({
        title: "Error",
        description: "Failed to load prizes from Firebase.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description) {
      toast({ 
        title: "Missing fields", 
        description: "Name and description are required.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      if (editingPrize) {
        await updatePrize(editingPrize.id, formData);
        toast({ 
          title: "Prize Updated", 
          description: `${formData.name} has been updated in Firebase.` 
        });
      } else {
        await addPrize(formData);
        toast({ 
          title: "Prize Added", 
          description: `${formData.name} has been added to Firebase.` 
        });
      }
      
      // Reload prizes
      await loadPrizes();
      
      // Reset form
      setFormData({ name: '', description: '', imageUrl: '' });
      setEditingPrize(null);
      setIsFormOpen(false);
    } catch (error) {
      console.error('Error saving prize:', error);
      toast({
        title: "Error",
        description: "Failed to save prize to Firebase.",
        variant: "destructive",
      });
    }
  };

  const openEditForm = (prize: Prize) => {
    setEditingPrize(prize);
    setFormData({ 
      name: prize.name, 
      description: prize.description, 
      imageUrl: prize.imageUrl 
    });
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingPrize(null);
    setFormData({ name: '', description: '', imageUrl: '' });
    setIsFormOpen(true);
  };

  const handleDeletePrize = async (prizeId: string, prizeName: string) => {
    try {
      await deletePrize(prizeId);
      toast({ 
        title: "Prize Deleted", 
        description: `${prizeName} has been removed from Firebase.`, 
        variant: "destructive" 
      });
      
      // Reload prizes
      await loadPrizes();
    } catch (error) {
      console.error('Error deleting prize:', error);
      toast({
        title: "Error",
        description: "Failed to delete prize from Firebase.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Prizes from Firebase...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle className="font-headline text-2xl">Manage Prizes (Firebase)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Prizes are stored in Firebase and sync across all users
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadPrizes} variant="outline" size="sm">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewForm}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Prize
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingPrize ? 'Edit Prize' : 'Add New Prize'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Prize Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input 
                    id="imageUrl" 
                    name="imageUrl" 
                    value={formData.imageUrl} 
                    onChange={handleInputChange} 
                    placeholder="https://example.com/image.jpg" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use any HTTPS image URL. Leave blank for default placeholder.
                  </p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">
                    {editingPrize ? 'Save Changes' : 'Add Prize'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {prizes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No prizes found in Firebase.</p>
            <Button onClick={openNewForm} className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Your First Prize
            </Button>
          </div>
        ) : (
          <ul className="space-y-4">
            {prizes.map((prize) => (
              <li key={prize.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border rounded-lg gap-4">
                <div className="flex-grow">
                  <h3 className="font-semibold">{prize.name}</h3>
                  <p className="text-sm text-muted-foreground truncate max-w-md">
                    {prize.description}
                  </p>
                  {prize.imageUrl && (
                    <p className="text-xs text-blue-600 mt-1 truncate max-w-md">
                      🖼️ {prize.imageUrl}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Entries: {prize.entries?.length || 0} | 
                    Total Tickets: {prize.totalTicketsInPrize || 0}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => openEditForm(prize)}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the prize "{prize.name}" from Firebase.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeletePrize(prize.id, prize.name)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}