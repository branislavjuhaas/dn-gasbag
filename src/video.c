#include "video.h"

unsigned char g_current_buffer = 0;

#pragma region assembly_functions

/* We use DX for the segment so it doesn't collide with AX */
void clear_page_asm(unsigned char attribute, unsigned short segment);

#pragma aux clear_page_asm =    \
"mov es, dx"                \
"xor di, di"                \
"mov ah, bl"                \
"mov al, 20h"               \
"mov cx, 2000"              \
"rep stosw"                 \
parm [bl] [dx]              \
modify [ax cx di es];

void change_buffer_asm(unsigned char buffer_to_show);

#pragma aux change_buffer_asm = \
"mov ah, 05h"               \
"int 10h"                   \
parm [al]                   \
modify [ah];

#pragma endregion

void flip_buffer(void) {
    g_current_buffer = !g_current_buffer;
    change_buffer_asm(g_current_buffer);
}

// void clear_screen(const unsigned char attribute) {
//     unsigned short segment_to_clear = 0xB800 + (256 * !g_current_buffer);
//     clear_page_asm(attribute, segment_to_clear);
//
//     flip_buffer();
//
//     segment_to_clear = 0xB800 + (256 * !g_current_buffer);
//     clear_page_asm(attribute, segment_to_clear);
// }

// Only clears the one buffer that the user CANNOT see
void clear_hidden_buffer(const unsigned char attribute) {
    const unsigned short hidden_segment = 0xB800 + (256 * !g_current_buffer);
    clear_page_asm(attribute, hidden_segment);
}
