#include "video.h"

int main(void) {
    clear_hidden_buffer(0b00011111); // Clear screen with white on blue
    flip_buffer();
    return 0;
}
