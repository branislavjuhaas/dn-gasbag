using SadConsole.Configuration;

Settings.WindowTitle = "My SadConsole Game";

Builder
    .GetBuilder()
    .SetWindowSizeInCells(80, 25)
    .SetStartingScreen<Gasbag.Scenes.Menu>()
    .IsStartingScreenFocused(true)
    .ConfigureFonts(true)
    .Run();