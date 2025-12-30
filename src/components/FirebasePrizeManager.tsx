"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Edit, Plus, RefreshCw, Trophy, Target } from 'lucide-react';
import { 
  addPrize,
  getPrizes,
  updatePrize,
  deletePrize,
  convertFirebasePrizeToAppPrize,
  uploadPrizeImage,
  addPrizeTier,
  getPrizeTiers,
  updatePrizeTier,
  deletePrizeTier,
  convertFirebasePrizeTierToAppTier,
  type FirebasePrize,
  type FirebasePrizeTier
} from '@/lib/firebaseService';
import { useAppContext } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function FirebasePrizeManager() {
  const [prizes, setPrizes] = useState<FirebasePrize[]>([]);
  const [tiers, setTiers] = useState<FirebasePrizeTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrize, setEditingPrize] = useState<FirebasePrize | null>(null);
  const [editingTier, setEditingTier] = useState<FirebasePrizeTier | null>(null);
  const [isPrizeDialogOpen, setIsPrizeDialogOpen] = useState(false);
  const [isTierDialogOpen, setIsTierDialogOpen] = useState(false);
  const [deletePrizeId, setDeletePrizeId] = useState<string | null>(null);
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null);
  const [prizeFormData, setPrizeFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    tierId: 'no-tier',
    numberOfWinners: 1
  });
  const [excludedFacilitiesInput, setExcludedFacilitiesInput] = useState('');
  const [prizeImageFile, setPrizeImageFile] = useState<File | null>(null);
  const [prizeImagePreview, setPrizeImagePreview] = useState('');
  const [tierFormData, setTierFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    order: 0
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

  const loadTiers = async () => {
    setLoading(true);
    try {
      const firebaseTiers = await getPrizeTiers();
      setTiers(firebaseTiers);
      
      // Convert to app format and update context
      const appTiers = firebaseTiers.map(convertFirebasePrizeTierToAppTier);
      dispatch({
        type: 'SET_FIREBASE_PRIZE_TIERS',
        payload: appTiers
      });
      
    } catch (error: any) {
      console.error('Error loading tiers:', error);
      toast({
        title: "Error",
        description: "Failed to load tiers from Firebase",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadPrizes(), loadTiers()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    return () => {
      if (prizeImagePreview && prizeImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(prizeImagePreview);
      }
    };
  }, [prizeImagePreview]);

  const handlePrizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrlToSave = prizeFormData.imageUrl;
      const normalizedExcludedFacilities = excludedFacilitiesInput
        .split(',')
        .map(facility => facility.trim())
        .filter(Boolean);

      if (prizeImageFile) {
        imageUrlToSave = await uploadPrizeImage(prizeImageFile);
      }

      if (!imageUrlToSave) {
        toast({
          title: "Image Required",
          description: "Please upload an image for the prize.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (editingPrize) {
        // Update existing prize
        await updatePrize(editingPrize.id!, {
          name: prizeFormData.name,
          description: prizeFormData.description,
          imageUrl: imageUrlToSave,
          tierId: prizeFormData.tierId === 'no-tier' ? undefined : prizeFormData.tierId || undefined,
          numberOfWinners: prizeFormData.numberOfWinners || 1,
          excludedFacilities: normalizedExcludedFacilities
        });
        toast({
          title: "Success",
          description: "Prize updated successfully"
        });
      } else {
        // Add new prize
        await addPrize({
          name: prizeFormData.name,
          description: prizeFormData.description,
          imageUrl: imageUrlToSave,
          entries: [],
          totalTicketsInPrize: 0,
          tierId: prizeFormData.tierId === 'no-tier' ? undefined : prizeFormData.tierId || undefined,
          numberOfWinners: prizeFormData.numberOfWinners || 1,
          excludedFacilities: normalizedExcludedFacilities
        });
        toast({
          title: "Success",
          description: "Prize added successfully"
        });
      }
      
      await loadPrizes();
      setIsPrizeDialogOpen(false);
      setEditingPrize(null);
      setPrizeFormData({ name: '', description: '', imageUrl: '', tierId: 'no-tier', numberOfWinners: 1 });
      setPrizeImageFile(null);
      setPrizeImagePreview('');
      setExcludedFacilitiesInput('');

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

  const handleTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingTier) {
        // Update existing tier
        await updatePrizeTier(editingTier.id!, {
          name: tierFormData.name,
          description: tierFormData.description,
          color: tierFormData.color,
          order: tierFormData.order
        });
        toast({
          title: "Success",
          description: "Tier updated successfully"
        });
      } else {
        // Add new tier
        await addPrizeTier({
          name: tierFormData.name,
          description: tierFormData.description,
          color: tierFormData.color,
          order: tierFormData.order
        });
        toast({
          title: "Success",
          description: "Tier added successfully"
        });
      }
      
      await loadTiers();
      setIsTierDialogOpen(false);
      setEditingTier(null);
      setTierFormData({ name: '', description: '', color: '#3b82f6', order: 0 });
      
    } catch (error: any) {
      console.error('Error saving tier:', error);
      toast({
        title: "Error",
        description: "Failed to save tier",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrize = async (prizeId: string) => {
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

  const handleDeleteTier = async (tierId: string) => {
    setLoading(true);
    try {
      await deletePrizeTier(tierId);
      await loadAll();
      toast({
        title: "Success",
        description: "Tier deleted successfully"
      });
    } catch (error: any) {
      console.error('Error deleting tier:', error);
      toast({
        title: "Error",
        description: "Failed to delete tier",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditPrizeDialog = (prize: FirebasePrize) => {
    setEditingPrize(prize);
    setPrizeFormData({
      name: prize.name,
      description: prize.description,
      imageUrl: prize.imageUrl,
      tierId: prize.tierId || 'no-tier',
      numberOfWinners: prize.numberOfWinners || 1
    });
    setExcludedFacilitiesInput((prize.excludedFacilities || []).join(', '));
    setPrizeImageFile(null);
    setPrizeImagePreview(prize.imageUrl || '');
    setIsPrizeDialogOpen(true);
  };

  const openAddPrizeDialog = () => {
    setEditingPrize(null);
    setPrizeFormData({ name: '', description: '', imageUrl: '', tierId: 'no-tier', numberOfWinners: 1 });
    setPrizeImageFile(null);
    setPrizeImagePreview('');
    setExcludedFacilitiesInput('');
    setIsPrizeDialogOpen(true);
  };

  const openEditTierDialog = (tier: FirebasePrizeTier) => {
    setEditingTier(tier);
    setTierFormData({
      name: tier.name,
      description: tier.description,
      color: tier.color,
      order: tier.order
    });
    setIsTierDialogOpen(true);
  };

  const openAddTierDialog = () => {
    setEditingTier(null);
    setTierFormData({ 
      name: '', 
      description: '', 
      color: '#3b82f6', 
      order: tiers.length 
    });
    setIsTierDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Firebase Prize & Tier Manager
            <Button
              onClick={loadAll}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="prizes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prizes">Prizes</TabsTrigger>
              <TabsTrigger value="tiers">Tiers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="prizes" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Prizes</h3>
                <Dialog open={isPrizeDialogOpen} onOpenChange={setIsPrizeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddPrizeDialog} size="sm">
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
                    <form onSubmit={handlePrizeSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="prizeName">Prize Name</Label>
                        <Input
                          id="prizeName"
                          value={prizeFormData.name}
                          onChange={(e) => setPrizeFormData(prev => ({ ...prev, name: e.target.value }))}
                          required
                          placeholder="Enter prize name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="prizeDescription">Description</Label>
                        <Textarea
                          id="prizeDescription"
                          value={prizeFormData.description}
                          onChange={(e) => setPrizeFormData(prev => ({ ...prev, description: e.target.value }))}
                          required
                          placeholder="Enter prize description"
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="prizeWinners">Number of drawings for this prize</Label>
                        <Input
                          id="prizeWinners"
                          type="number"
                          min={1}
                          value={prizeFormData.numberOfWinners}
                          onChange={(e) => setPrizeFormData(prev => ({ ...prev, numberOfWinners: Math.max(1, Number(e.target.value) || 1) }))}
                        />
                        <p className="text-xs text-muted-foreground">Set how many unique winners this prize should have.</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="excludedFacilities">Excluded Facilities</Label>
                        <Input
                          id="excludedFacilities"
                          value={excludedFacilitiesInput}
                          onChange={(e) => setExcludedFacilitiesInput(e.target.value)}
                          placeholder="e.g. Downtown Warehouse, Remote Office"
                        />
                        <p className="text-xs text-muted-foreground">
                          People from these facilities will be skipped when drawing winners for this prize. Separate multiple facilities with commas.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="prizeImage">Prize Image</Label>
                        <Input
                          id="prizeImage"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (!file.type.startsWith('image/')) {
                              toast({
                                title: "Invalid file",
                                description: "Please upload an image file (JPEG or PNG).",
                                variant: "destructive"
                              });
                              return;
                            }

                            if (prizeImagePreview && prizeImagePreview.startsWith('blob:')) {
                              URL.revokeObjectURL(prizeImagePreview);
                            }

                            setPrizeImageFile(file);
                            setPrizeImagePreview(URL.createObjectURL(file));
                          }}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground">
                          Upload a JPEG or PNG. If you do not pick a new file when editing, the current image will remain.
                        </p>
                        {(prizeImagePreview || prizeFormData.imageUrl) && (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-muted-foreground">Preview</p>
                            <div className="rounded-md border p-2 bg-muted/40">
                              <img
                                src={prizeImagePreview || prizeFormData.imageUrl}
                                alt={prizeFormData.name || 'Prize preview'}
                                className="w-full h-auto max-h-48 object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="prizeTier">Tier (Optional)</Label>
                        <Select 
                          value={prizeFormData.tierId} 
                          onValueChange={(value) => setPrizeFormData(prev => ({ ...prev, tierId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a tier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no-tier">No Tier</SelectItem>
                            {tiers.map((tier) => (
                              <SelectItem key={tier.id} value={tier.id!}>
                                <div className="flex items-center">
                                  <div 
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: tier.color }}
                                  />
                                  {tier.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button type="submit" disabled={loading}>
                          {loading ? 'Saving...' : (editingPrize ? 'Update' : 'Add')} Prize
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsPrizeDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              
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
                  {prizes.map((prize) => {
                    const tier = tiers.find(t => t.id === prize.tierId);
                    return (
                      <Card key={prize.id} className="relative">
                        <CardContent className="p-4">
                          <div className="mb-3 bg-gray-100 rounded-md overflow-hidden">
                            <img
                              src={prize.imageUrl}
                              alt={prize.name}
                              className="w-full h-auto object-contain max-h-48"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/300x200.png';
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{prize.name}</h3>
                            {tier && (
                              <div
                                className="px-2 py-1 rounded text-xs font-medium text-white"
                                style={{ backgroundColor: tier.color }}
                              >
                                {tier.name}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">Drawings: {prize.numberOfWinners || 1}</p>
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
                              onClick={() => openEditPrizeDialog(prize)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeletePrizeId(prize.id!)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="tiers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Prize Tiers</h3>
                <Dialog open={isTierDialogOpen} onOpenChange={setIsTierDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddTierDialog} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tier
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingTier ? 'Edit Tier' : 'Add New Tier'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTierSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="tierName">Tier Name</Label>
                        <Input
                          id="tierName"
                          value={tierFormData.name}
                          onChange={(e) => setTierFormData(prev => ({ ...prev, name: e.target.value }))}
                          required
                          placeholder="Enter tier name (e.g., Gold, Silver, Bronze)"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="tierDescription">Description</Label>
                        <Textarea
                          id="tierDescription"
                          value={tierFormData.description}
                          onChange={(e) => setTierFormData(prev => ({ ...prev, description: e.target.value }))}
                          required
                          placeholder="Enter tier description"
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="tierColor">Color</Label>
                        <Input
                          id="tierColor"
                          type="color"
                          value={tierFormData.color}
                          onChange={(e) => setTierFormData(prev => ({ ...prev, color: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="tierOrder">Order</Label>
                        <Input
                          id="tierOrder"
                          type="number"
                          value={tierFormData.order}
                          onChange={(e) => setTierFormData(prev => ({ ...prev, order: parseInt(e.target.value) }))}
                          required
                          placeholder="Enter sort order"
                        />
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button type="submit" disabled={loading}>
                          {loading ? 'Saving...' : (editingTier ? 'Update' : 'Add')} Tier
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsTierDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              
              {loading && tiers.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Loading tiers...</p>
                </div>
              ) : tiers.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No tiers found. Add your first tier to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {tiers.map((tier) => {
                    const tierPrizes = prizes.filter(p => p.tierId === tier.id);
                    return (
                      <Card key={tier.id} className="relative">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{tier.name}</h3>
                            <div 
                              className="w-6 h-6 rounded-full"
                              style={{ backgroundColor: tier.color }}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {tier.description}
                          </p>
                          <div className="text-xs text-muted-foreground mb-3">
                            Order: {tier.order} | Prizes: {tierPrizes.length}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditTierDialog(tier)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteTierId(tier.id!)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={!!deletePrizeId} onOpenChange={(open) => !open && setDeletePrizeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prize?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The prize will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deletePrizeId) handleDeletePrize(deletePrizeId); setDeletePrizeId(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTierId} onOpenChange={(open) => !open && setDeleteTierId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove tier assignments from all prizes in this tier. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTierId) handleDeleteTier(deleteTierId); setDeleteTierId(null); }}>
              Delete Tier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
