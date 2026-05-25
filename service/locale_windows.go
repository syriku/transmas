package service

import (
	"strings"
	"syscall"
	"unicode/utf16"
	"unsafe"
)

func getSystemLanguage() string {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	proc := kernel32.NewProc("GetUserDefaultLocaleName")
	if proc.Find() == nil {
		buffer := make([]uint16, 85) // LOCALE_NAME_MAX_LENGTH is 85
		ret, _, _ := proc.Call(
			uintptr(unsafe.Pointer(&buffer[0])),
			uintptr(len(buffer)),
		)
		if ret > 0 {
			return strings.TrimSpace(string(utf16.Decode(buffer[:ret-1])))
		}
	}

	return getFallbackLanguage()
}
