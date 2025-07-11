"use client";
import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Camera, Upload, User, ArrowRight, RotateCcw } from 'lucide-react';
import { uploadProfilePictureFromDataURL, uploadProfilePicture, updateUserProfilePicture } from '@/lib/firebaseService';

export default function ProfilePicturePage() {
  const { state, dispatch } = useAppContext();
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redirect if not logged in
  React.useEffect(() => {
    if (state.currentUser === null) {
      router.push('/login');
    }
  }, [state.currentUser, router]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      
      setStream(mediaStream);
      setShowCamera(true);
      
      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch((playError) => {
            console.error('Error playing video:', playError);
            setCameraError('Failed to start camera preview');
          });
        }
      }, 100);
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      let errorMessage = 'Could not access camera. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      setCameraError(errorMessage);
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setCameraError(null);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const dataURL = canvas.toDataURL('image/jpeg', 0.8);
        setSelectedImage(dataURL);
        setSelectedFile(null); // Clear file selection since we're using camera
        stopCamera();
      } else {
        toast({
          title: "Camera Error",
          description: "Unable to capture photo. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive"
        });
      }
    }
  }, []);

  const handleSave = async () => {
    if (!selectedImage || !state.currentUser) return;
    
    setIsLoading(true);
    try {
      let profilePictureUrl: string;
      
      // Upload profile picture to Firebase Storage
      if (selectedFile) {
        // File upload
        profilePictureUrl = await uploadProfilePicture(state.currentUser.id, selectedFile);
      } else {
        // Camera capture (data URL)
        profilePictureUrl = await uploadProfilePictureFromDataURL(
          state.currentUser.id, 
          selectedImage
        );
      }
      
      // Update user document in Firestore
      await updateUserProfilePicture(state.currentUser.id, profilePictureUrl);
      
      // Update the user's profile picture in the app context
      dispatch({
        type: 'UPDATE_PROFILE_PICTURE',
        payload: {
          userId: state.currentUser.id,
          profilePictureUrl: profilePictureUrl
        }
      });
      
      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been saved successfully!"
      });
      
      router.push('/');
    } catch (error) {
      console.error('Error saving profile picture:', error);
      toast({
        title: "Save Error",
        description: "Failed to save profile picture. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/');
  };

  if (!state.currentUser) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">
              Add Your Profile Picture
            </CardTitle>
            <CardDescription>
              Welcome {state.currentUser.firstName}! Let's add a profile picture to personalize your account.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Current/Selected Image Preview */}
            <div className="flex justify-center">
              <Avatar className="w-32 h-32 border-4 border-gray-200">
                <AvatarImage src={selectedImage || ''} />
                <AvatarFallback className="text-2xl bg-gray-100">
                  <User className="w-16 h-16 text-gray-400" />
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Camera View */}
            {showCamera && (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 object-cover"
                    onLoadedMetadata={() => {
                      // Ensure video plays when metadata is loaded
                      if (videoRef.current) {
                        videoRef.current.play().catch(console.error);
                      }
                    }}
                  />
                  {stream && (
                    <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                      Camera Active
                    </div>
                  )}
                  {cameraError && (
                    <div className="absolute inset-0 bg-red-900 bg-opacity-75 flex items-center justify-center p-4">
                      <div className="text-white text-center">
                        <p className="font-semibold">Camera Error</p>
                        <p className="text-sm">{cameraError}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={capturePhoto} 
                    className="flex items-center gap-2"
                    disabled={!stream || !!cameraError}
                  >
                    <Camera className="w-4 h-4" />
                    Capture Photo
                  </Button>
                  <Button onClick={stopCamera} variant="outline" className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!showCamera && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={startCamera}
                  variant="outline"
                  className="h-20 flex flex-col items-center gap-2"
                >
                  <Camera className="w-6 h-6" />
                  <span>Take Photo</span>
                </Button>
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="h-20 flex flex-col items-center gap-2"
                >
                  <Upload className="w-6 h-6" />
                  <span>Upload Photo</span>
                </Button>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Hidden Canvas for Photo Capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={!selectedImage || isLoading}
                className="flex items-center gap-2 flex-1"
              >
                {isLoading ? 'Saving...' : 'Save & Continue'}
                <ArrowRight className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={handleSkip}
                variant="ghost"
                className="flex items-center gap-2"
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}