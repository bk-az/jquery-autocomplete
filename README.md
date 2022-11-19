jQuery Autocomplete: An Autocomplete Text Entry
=======================================================

![](demo.gif)

Overview
--------
jQuery Autocomplete is a jQuery plugin, once initialized on a text field it allows you to select items from a predefined list or from a remote source, using autocomplete as you type to find an item. If you are already familiar with jquery-tokeninput, then it's the same thing.

Quick Start
--------
For a simple server-backed search, just define an endpiont that returns json Array in this format:
```json
[
    { "name": "Java" },
    { "name": "Ruby" },
]
```
You can then use it as srouce:
```html
<!-- jquery is required -->
<script src="https://code.jquery.com/jquery-3.6.1.min.js" integrity="sha256-o88AwQnZB+VDvE9tvIXrMQaPlFFSUTR+nldQm1LuPXQ=" crossorigin="anonymous"></script>
<script type="text/javascript" src="yourfiles/jquery.autocomplete.js"></script>
<link rel="stylesheet" type="text/css" href="yourfiles/autocomplete.css" />

<script type="text/javascript">
  $(document).ready(function() {
      $("#demo-input").autoComplete("https://example.com/search");
  });
</script>
```
Examples
--------
For example please check [demo](demo.html) file.

Configuration
--------
There are different options availble allows you to customize according to your needs
Autocomplete is forked from tokeninput, so most of the configurations are same, please check [this link](http://loopj.com/jquery-tokeninput/)
