// Backend/gps_tokenizer.c
#include <stdio.h>
#include <string.h> // Para strlen
#include <stdint.h> // Para uintptr_t

// Declaración para exportación en Windows
#if defined(_WIN32) || defined(_WIN64)
    #define DLL_EXPORT __declspec(dllexport)
#else
    #define DLL_EXPORT
#endif

// Constantes para el número máximo de campos y longitud máxima de token
#define MAX_GPS_FIELDS 4
#define MAX_TOKEN_LEN 32 // Asigna suficiente espacio para cada token (ej: "-123.456789")

/*
 * Función auxiliar que copia un token desde 'src' a 'dest' hasta encontrar 'delim'
 * o alcanzar 'max_dest_len' o fin de 'src'.
 * Usa ensamblador inline para la copia del bucle.
 * Devuelve el número de caracteres copiados (excluyendo el terminador nulo).
 */
static int copy_token_asm(const char *src, char delim, char *dest, int max_dest_len) {
    int copied_len = 0;
    if (!src || !dest || max_dest_len <= 0) {
        return 0;
    }

    // Ensamblador inline para GCC/Clang (sintaxis AT&T) en x86-64.
    // %0: copied_len (salida, lectura/escritura) -> edi (como int)
    // %1: src (entrada, puntero) -> rsi
    // %2: delim (entrada, caracter) -> bl (como char)
    // %3: dest (entrada, puntero) -> rdi (sobreescrito por el puntero a dest)
    // %4: max_dest_len (entrada, int) -> ecx
    // Nota: Usamos registros específicos para ciertas instrucciones de string si fuera el caso,
    // pero aquí un bucle manual es más claro para la demostración.
    // 'count' está en %0 (eax/rax), 'i' (índice de bucle) en rcx.

    asm volatile (
        "xorl %%eax, %%eax;"         // eax = 0 (será nuestra longitud copiada, copied_len)
        "movb %2, %%bl;"             // Carga delim en bl
        // rsi (src) y rdi (dest) ya están implícitos por los operandos de entrada
        // rcx (max_dest_len) también

    "1:" // Etiqueta de inicio de bucle
        "cmpl %%eax, %4;"            // Compara copied_len con max_dest_len - 1 (para dejar espacio para '\0')
        "jge 2f;"                    // Si copied_len >= max_dest_len -1, ir a fin_copia

        "movb (%1), %%dl;"           // Carga byte de src -> dl
        "testb %%dl, %%dl;"          // Comprueba si es fin de cadena (carácter nulo)
        "jz 2f;"                     // Si es nulo, ir a fin_copia

        "cmpb %%bl, %%dl;"           // Compara el byte actual (dl) con delim (bl)
        "je 2f;"                     // Si es igual al delimitador, ir a fin_copia

        "movb %%dl, (%3);"           // Copia el byte de src a dest
        "incq %1;"                   // src++
        "incq %3;"                   // dest++
        "incl %%eax;"                // copied_len++
        "jmp 1b;"                    // Repetir bucle

    "2:" // Etiqueta de fin_copia
        "movb $0, (%3);"             // Añade terminador nulo a dest
        "movl %%eax, %0;"            // Mueve el resultado de eax a copied_len
        : "=r" (copied_len)          // %0: Salida (copied_len)
        : "r" (src),                 // %1: Entrada (src)
          "r" ((unsigned char)delim),// %2: Entrada (delim)
          "r" (dest),                // %3: Entrada (dest)
          "r" (max_dest_len -1)      // %4: Entrada (max_dest_len - 1 para espacio de '\0')
        : "rax", "rbx", "rcx", "rdx", "rsi", "rdi", "memory", "cc" // Registros modificados
    );
    
    return copied_len;
}


/*
 * Función principal exportada.
 * Parsea 'input_str' buscando tokens delimitados por 'delim'.
 * Almacena los tokens en los buffers de salida proporcionados.
 * * Entradas:
 * input_str: La cadena a tokenizar (ej: "19.043,-98.194,60.5,25.1").
 * delim: El carácter delimitador (ej: ',').
 * out_lat, out_lon, out_hum, out_temp: Buffers para almacenar los tokens.
 * max_len: La longitud máxima de cada buffer de salida (debe ser MAX_TOKEN_LEN).
 *
 * Retorno:
 * El número de campos exitosamente extraídos y copiados.
 * Devuelve -1 si hay un error de puntero nulo.
 */
DLL_EXPORT int tokenize_and_extract_gps_fields_asm(
    const char *input_str,
    char delim,
    char *out_lat, char *out_lon, char *out_hum, char *out_temp,
    int max_len // Usamos una sola max_len asumiendo que todos los buffers son iguales
) {
    if (!input_str || !out_lat || !out_lon || !out_hum || !out_temp) {
        return -1; // Error de puntero nulo
    }

    // Limpiar buffers de salida (opcional pero buena práctica)
    out_lat[0] = '\0';
    out_lon[0] = '\0';
    out_hum[0] = '\0';
    out_temp[0] = '\0';

    char* buffers[MAX_GPS_FIELDS] = {out_lat, out_lon, out_hum, out_temp};
    const char *current_pos = input_str;
    int fields_found = 0;

    for (int i = 0; i < MAX_GPS_FIELDS; ++i) {
        if (*current_pos == '\0') { // Fin de la cadena de entrada
            break;
        }

        int copied_count = copy_token_asm(current_pos, delim, buffers[i], max_len);
        
        fields_found++;
        current_pos += copied_count; // Avanzar puntero de entrada

        if (*current_pos == delim) {
            current_pos++; // Saltar el delimitador para el siguiente token
        } else if (*current_pos == '\0') {
            break; // Fin de la cadena de entrada después de un token
        } else {
            // Situación inesperada, podría ser un token más largo que max_len
            // o formato incorrecto. Por ahora, simplemente paramos.
            break; 
        }
    }
    return fields_found;
}

/* --- Función de prueba (opcional, para compilación independiente) ---
int main() {
    char lat[MAX_TOKEN_LEN], lon[MAX_TOKEN_LEN], hum[MAX_TOKEN_LEN], temp[MAX_TOKEN_LEN];
    const char* test_str1 = "19.12345,-98.54321,60.5,25.1";
    const char* test_str2 = "20.001,-99.002";
    const char* test_str3 = "21.1, -100.2, 70, "; // Humedad con espacio, temperatura vacía
    const char* test_str4 = "verylongtoken123456789012345678901234567890,next";

    int result;

    printf("Probando: '%s'\n", test_str1);
    result = tokenize_and_extract_gps_fields_asm(test_str1, ',', lat, lon, hum, temp, MAX_TOKEN_LEN);
    printf("Campos encontrados: %d\n", result);
    printf("Lat: '%s', Lon: '%s', Hum: '%s', Temp: '%s'\n\n", lat, lon, hum, temp);

    printf("Probando: '%s'\n", test_str2);
    result = tokenize_and_extract_gps_fields_asm(test_str2, ',', lat, lon, hum, temp, MAX_TOKEN_LEN);
    printf("Campos encontrados: %d\n", result);
    printf("Lat: '%s', Lon: '%s', Hum: '%s', Temp: '%s'\n\n", lat, lon, hum, temp);
    
    printf("Probando: '%s'\n", test_str3);
    result = tokenize_and_extract_gps_fields_asm(test_str3, ',', lat, lon, hum, temp, MAX_TOKEN_LEN);
    printf("Campos encontrados: %d\n", result);
    printf("Lat: '%s', Lon: '%s', Hum: '%s', Temp: '%s'\n\n", lat, lon, hum, temp);

    printf("Probando: '%s'\n", test_str4);
    result = tokenize_and_extract_gps_fields_asm(test_str4, ',', lat, lon, hum, temp, MAX_TOKEN_LEN);
    printf("Campos encontrados: %d\n", result);
    printf("Lat: '%s', Lon: '%s', Hum: '%s', Temp: '%s'\n\n", lat, lon, hum, temp);

    return 0;
}
*/