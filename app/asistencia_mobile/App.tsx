import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions,
  Animated,
  Easing,
  StatusBar,
  TextInput,
  Alert,
  Platform,
  Image,
  KeyboardAvoidingView
} from 'react-native';
import * as Location from 'expo-location';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { getDistance } from 'geolib';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function App() {
  // --------- ESTADOS DE AUTENTICACION Y PERFIL ---------
  const [siteUrl, setSiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  
  const [profile, setProfile] = useState<any>(null);
  
  // --------- ESTADOS DE GEOLOCALIZACION ---------
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCheckingLoc, setIsCheckingLoc] = useState(false);

  // Animación status
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    checkLocalSession();
  }, []);

  useEffect(() => {
    if (sessionActive && profile) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();
      
      startLocationSequence();
    }
  }, [sessionActive]);

  const checkLocalSession = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('SITE_URL');
      if (savedUrl) {
        setSiteUrl(savedUrl);
        await getProfile(savedUrl); // intentamos usar la cookie almacenada por RN
      } else {
        setIsCheckingSession(false);
      }
    } catch (e) {
      setIsCheckingSession(false);
    }
  };

  const login = async () => {
    if (!siteUrl || !email || !password) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }
    
    // Format URL (remove trailing slash and auto-prepend https:// if missing)
    let formattedUrl = siteUrl.trim().replace(/\/$/, "");
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    await AsyncStorage.setItem('SITE_URL', formattedUrl);
    setSiteUrl(formattedUrl);

    setIsLoggingIn(true);
    try {
      console.log(`Llamando: ${formattedUrl}/api/method/login`);
      const res = await fetch(`${formattedUrl}/api/method/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ usr: email, pwd: password }),
        credentials: 'include' // IMPORTANTE: Guarda la cookie 'sid' de Frappe
      });

      const data = await res.json();
      
      if (res.ok && data.message === "Logged In") {
        console.log("Login exitoso, obteniendo perfil...");
        await getProfile(formattedUrl);
      } else {
        Alert.alert('Error de inicio de sesión', data.message || 'Credenciales inválidas');
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error de conexión', e.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getProfile = async (url: string) => {
    try {
      const res = await fetch(`${url}/api/method/control_asistencia.control_asistencia.shift_panel.get_mobile_profile`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      console.log("Perfil: ", data);
      if (data.message && data.message.employee_id) {
        setProfile(data.message);
        setSessionActive(true);
        return data.message;
      } else {
        // Falló obtener el perfil (probablemente sesión expirada)
        setSessionActive(false);
      }
    } catch (e) {
      console.error("Error perfil", e);
      setSessionActive(false);
    } finally {
      setIsCheckingSession(false);
    }
    return null;
  };

  const logout = async () => {
    try {
      await fetch(`${siteUrl}/api/method/logout`, { credentials: 'include' });
      setSessionActive(false);
      setProfile(null);
    } catch(e) { }
  };

  const startLocationSequence = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('El permiso para acceder a la ubicación fue denegado. Actívalo en la configuración de la App.');
      return;
    }
    await updateLocation();
  };

  const updateLocation = async () => {
    if (!profile) return null;
    setIsCheckingLoc(true);
    setErrorMsg(null);
    try {
      const activeProfile = await getProfile(siteUrl) || profile;

      let currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);

      let calcDist = null;
      if (activeProfile.branch_lat && activeProfile.branch_lng) {
        calcDist = getDistance(
          { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
          { latitude: activeProfile.branch_lat, longitude: activeProfile.branch_lng }
        );
        setDistance(calcDist);
      } else {
        setDistance(null);
      }
      return { activeProfile, calcDist, currentLocation };
    } catch (e) {
      setErrorMsg('No se pudo obtener la ubicación actual.');
      return null;
    } finally {
      setIsCheckingLoc(false);
    }
  };

  const handleCheckInOut = async (actionType: 'IN' | 'OUT') => {
    const locData = await updateLocation();
    if (!locData) return;
    const { activeProfile, calcDist, currentLocation } = locData;

    // Obtener ID único del dispositivo móvil simulando la "MAC"
    let deviceId = 'unknown';
    try {
        if (Platform.OS === 'android') {
            deviceId = Application.getAndroidId();
        } else if (Platform.OS === 'ios') {
            deviceId = await Application.getIosIdForVendorAsync() || 'unknown';
        }
    } catch(e) {}

    if (activeProfile.branch_lat && activeProfile.branch_lng) {
        if (calcDist === null) return;
        const allowed_dist = activeProfile.max_distance ?? 20;
        if (calcDist > allowed_dist) {
            Alert.alert('Fuera de rango', `Estás a ${calcDist} metros. Necesitas estar a menos de ${allowed_dist}m de tu sucursal.`);
            return;
        }
    } else {
        Alert.alert('Advertencia', 'Tu sucursal no tiene coordenadas GPS configuradas. La marcación procederá sin validación de geocerca.');
    }

    try {
        setIsCheckingLoc(true);
        const res = await fetch(`${siteUrl}/api/method/control_asistencia.control_asistencia.shift_panel.record_mobile_checkin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                log_type: actionType,
                latitude: currentLocation?.coords.latitude,
                longitude: currentLocation?.coords.longitude,
                device_id: deviceId
            }),
            credentials: 'include'
        });
        const data = await res.json();
        
        if (res.ok && data.message) {
            Alert.alert('¡Éxito!', `Marcación de ${actionType === 'IN' ? 'Entrada' : 'Salida'} registrada correctamente.`);
            setProfile({ ...activeProfile, last_log_type: actionType });
        } else {
            let errorDetalle = data.exc_type || 'Error al guardar la marcación';
            if (data._server_messages) {
               try {
                  const msgs = JSON.parse(data._server_messages);
                  if (msgs.length > 0) {
                     const fMsg = JSON.parse(msgs[0]);
                     if (fMsg.message) errorDetalle += ': ' + fMsg.message.replace(/<[^>]+>/g, '');
                  }
               } catch(ex){}
            }
            throw new Error(errorDetalle);
        }
    } catch (e: any) {
        Alert.alert('Error', e.message);
    } finally {
        setIsCheckingLoc(false);
    }
  };


  // --------- RENDER CARGANDO ---------
  if (isCheckingSession) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // --------- RENDER LOGIN ---------
  if (!sessionActive) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'center', padding: 30 }}
        >
          <Image 
            source={require('./assets/icon.png')} 
            style={{ width: 150, height: 150, alignSelf: 'center', marginBottom: 40, resizeMode: 'contain' }} 
          />
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Servidor ERPNext (Ej. https://mi-erp.com)</Text>
            <TextInput 
              style={styles.input} 
              value={siteUrl} 
              onChangeText={setSiteUrl}
              placeholder="URL del sistema"
              placeholderTextColor="#475569"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Usuario o Correo</Text>
            <TextInput 
              style={styles.input} 
              value={email} 
              onChangeText={setEmail}
              placeholder="nombre de usuario o correo"
              placeholderTextColor="#475569"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput 
                style={styles.input} 
                value={password} 
                onChangeText={setPassword}
                placeholder="********"
                placeholderTextColor="#475569"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity 
                style={{ position: 'absolute', right: 15, padding: 5 }}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.btnLogin} 
            onPress={login}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // --------- RENDER PRINCIPAL ---------
  const allowed_dist = profile.max_distance ?? 20;
  const canAction = !profile.branch_lat || (distance !== null && distance <= allowed_dist);
  const status = profile.last_log_type === 'IN' ? 'checked-in' : 'checked-out';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* HEADER TIPO PREMIUM */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>Marcar Asistencia</Text>
          <TouchableOpacity onPress={logout}>
            <Text style={{ color: '#f43f5e', fontWeight: 'bold' }}>Salir</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 16 }}>Hola, {profile.employee_name}</Text>
        <View style={styles.branchContainer}>
          <Text style={styles.branchLabel}>Sucursal Asignada</Text>
          <Text style={styles.branchText}>{profile.branch || 'Sin sucursal'}</Text>
        </View>
      </View>

      <View style={styles.content}>
        
        {/* CARD DE ESTADO Y UBICACIÓN */}
        <Animated.View style={[styles.statusCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.indicatorContainer}>
            <View style={[styles.dot, 
              status === 'checked-in' ? styles.dotGreen : styles.dotGray
            ]} />
            <Text style={styles.statusText}>
              {status === 'checked-in' ? 'Turno Activo (Check-IN)' : 'Sin turno activo'}
            </Text>
          </View>
          
          <View style={styles.divider} />

          {errorMsg ? (
             <Text style={styles.errorText}>{errorMsg}</Text>
          ) : !profile.branch_lat ? (
             <Text style={styles.infoText}>Esta sucursal no tiene validación GPS activa.</Text>
          ) : isCheckingLoc ? (
            <ActivityIndicator size="small" color="#6366f1" style={{ marginVertical: 10 }} />
          ) : distance !== null ? (
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceLabel}>Distancia actual a la sucursal:</Text>
              <Text style={[styles.distanceValue, !canAction && styles.textRed]}>
                {distance} metros
              </Text>
              {!canAction && (
                <Text style={styles.warningText}>
                  Debes acercarte a {allowed_dist}m para registrarte.
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.infoText}>Obteniendo ubicación...</Text>
          )}

          <TouchableOpacity style={styles.refreshButton} onPress={updateLocation}>
            <Text style={styles.refreshButtonText}>Actualizar Ubicación</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ACCIONES */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.btnAction, styles.btnIn, (!canAction || status === 'checked-in') && styles.btnDisabled]} 
            onPress={() => handleCheckInOut('IN')}
            activeOpacity={0.8}
            disabled={!canAction || status === 'checked-in'}
          >
            <Text style={styles.btnText}>Check IN</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btnAction, styles.btnOut, (!canAction || status === 'checked-out') && styles.btnDisabled]} 
            onPress={() => handleCheckInOut('OUT')}
            activeOpacity={0.8}
            disabled={!canAction || status === 'checked-out'}
          >
            <Text style={styles.btnText}>Check OUT</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  header: {
    backgroundColor: '#1e293b', // Slate 800
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 10
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#cbd5e1',
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 16,
  },
  branchContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
  },
  branchLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  branchText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 25,
    justifyContent: 'center',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 25,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 40,
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  dotGray: { backgroundColor: '#cbd5e1' },
  dotGreen: { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  dotRed: { backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: '#e2e8f0',
    marginVertical: 15,
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 5,
  },
  distanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10b981', // green default
  },
  textRed: {
    color: '#ef4444', // red if too far
  },
  warningText: {
    marginTop: 8,
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  infoText: {
    color: '#64748b',
    fontSize: 14,
  },
  refreshButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#6366f1',
    fontWeight: '700',
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  btnAction: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  btnIn: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    marginRight: 10,
  },
  btnOut: {
    backgroundColor: '#f43f5e',
    shadowColor: '#f43f5e',
    marginLeft: 10,
  },
  btnLogin: {
    backgroundColor: '#6366f1',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#94a3b8',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  }
});
