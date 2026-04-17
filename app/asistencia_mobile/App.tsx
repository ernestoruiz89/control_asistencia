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
  StatusBar
} from 'react-native';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';

const { width } = Dimensions.get('window');

// Mock data (en producción, esto vendría del API de Frappe según el branch del empleado)
const SUCURSAL_LOCATION = {
  latitude: 12.1364, // Ejemplo: Managua
  longitude: -86.2514,
};

const ALLOWED_DISTANCE_METERS = 20;

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<'pending' | 'checked-in' | 'checked-out'>('pending');

  // Animation values
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('El permiso para acceder a la ubicación fue denegado.');
        return;
      }

      await updateLocation();
    })();
  }, []);

  useEffect(() => {
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
  }, [pulseAnim]);

  const updateLocation = async () => {
    setIsChecking(true);
    try {
      let currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);

      const dist = getDistance(
        { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
        { latitude: SUCURSAL_LOCATION.latitude, longitude: SUCURSAL_LOCATION.longitude }
      );
      setDistance(dist);
    } catch (e) {
      setErrorMsg('No se pudo obtener la ubicación.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleAction = async (actionType: 'check-in' | 'check-out') => {
    await updateLocation();
    
    if (distance === null) return;

    if (distance > ALLOWED_DISTANCE_METERS) {
        alert(`Estás a ${distance} metros. Necesitas estar a menos de ${ALLOWED_DISTANCE_METERS}m de la sucursal.`);
        return;
    }

    // Si tuvieramos backend, aquí llamaríamos al API.
    setStatus(actionType === 'check-in' ? 'checked-in' : 'checked-out');
  };

  const canAction = distance !== null && distance <= ALLOWED_DISTANCE_METERS;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* HEADER TIPO PREMIUM */}
      <View style={styles.header}>
        <Text style={styles.title}>Control de Asistencia</Text>
        <View style={styles.branchContainer}>
          <Text style={styles.branchLabel}>Sucursal Asignada</Text>
          <Text style={styles.branchText}>Managua Principal</Text>
        </View>
      </View>

      <View style={styles.content}>
        
        {/* CARD DE ESTADO Y UBICACIÓN */}
        <Animated.View style={[styles.statusCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.indicatorContainer}>
            <View style={[styles.dot, 
              status === 'checked-in' ? styles.dotGreen : 
              status === 'checked-out' ? styles.dotRed : styles.dotGray
            ]} />
            <Text style={styles.statusText}>
              {status === 'pending' ? 'Esperando Acción' : 
               status === 'checked-in' ? 'Turno Activo' : 'Turno Finalizado'}
            </Text>
          </View>
          
          <View style={styles.divider} />

          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : isChecking ? (
            <ActivityIndicator size="small" color="#6366f1" style={{ marginVertical: 10 }} />
          ) : distance !== null ? (
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceLabel}>Distancia actual a la sucursal:</Text>
              <Text style={[styles.distanceValue, !canAction && styles.textRed]}>
                {distance} metros
              </Text>
              {!canAction && (
                <Text style={styles.warningText}>
                  Debes acercarte a {ALLOWED_DISTANCE_METERS}m para registrarte.
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
            style={[styles.btnAction, styles.btnIn, !canAction && styles.btnDisabled]} 
            onPress={() => handleAction('check-in')}
            activeOpacity={0.8}
            disabled={!canAction || status === 'checked-in'}
          >
            <Text style={styles.btnText}>Check IN</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btnAction, styles.btnOut, !canAction && styles.btnDisabled]} 
            onPress={() => handleAction('check-out')}
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
